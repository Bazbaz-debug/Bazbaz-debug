from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator
from cryptography.fernet import Fernet
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, uuid, logging, asyncio, jwt, bcrypt, requests, resend, json, secrets, string

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from pypdf import PdfReader
from io import BytesIO
from twilio.rest import Client as TwilioClient
import fal_client
import base64
from bs4 import BeautifulSoup
from urllib.parse import quote as urlquote
import telnyx
import boto3
from botocore.exceptions import ClientError as BotoClientError
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build as gapi_build
from google.oauth2.credentials import Credentials as GoogleCreds

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
RESEND_API_KEY = os.environ['RESEND_API_KEY']
SENDER_EMAIL = os.environ['SENDER_EMAIL']
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
FERNET_KEY = os.environ.get('FERNET_KEY', '')
_fernet = Fernet(FERNET_KEY.encode()) if FERNET_KEY else None

def encrypt_secret(plain: str) -> str:
    if not plain or not _fernet:
        return plain or ""
    return _fernet.encrypt(plain.encode()).decode()

def decrypt_secret(token: str) -> str:
    if not token or not _fernet:
        return token or ""
    try:
        return _fernet.decrypt(token.encode()).decode()
    except Exception:
        return ""

def mask_secret(plain: str) -> str:
    if not plain:
        return ""
    if len(plain) <= 4:
        return "••••"
    return "••••" + plain[-4:]
APP_NAME = "rozio-killer"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_API_KEY_SID = os.environ.get("TWILIO_API_KEY_SID", "")
TWILIO_API_KEY_SECRET = os.environ.get("TWILIO_API_KEY_SECRET", "")
TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER", "")

def _twilio_client():
    """Return a Twilio Client using API Key auth when available, else Auth Token."""
    if TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET and TWILIO_SID:
        return TwilioClient(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_SID)
    if TWILIO_SID and TWILIO_TOKEN:
        return TwilioClient(TWILIO_SID, TWILIO_TOKEN)
    return None
ESCALATION_TARGET = os.environ.get("ESCALATION_TARGET_PHONE", "")
FAL_KEY = os.environ.get("FAL_KEY", "")
if FAL_KEY:
    os.environ["FAL_KEY"] = FAL_KEY  # fal-client reads from env

# Telnyx
TELNYX_API_KEY = os.environ.get("TELNYX_API_KEY", "")
TELNYX_PHONE_NUMBER = os.environ.get("TELNYX_PHONE_NUMBER", "")
TELNYX_BUSINESS_OWNER_PHONE = os.environ.get("TELNYX_BUSINESS_OWNER_PHONE", "")
if TELNYX_API_KEY:
    telnyx.api_key = TELNYX_API_KEY

# AWS SES
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_SES_REGION = os.environ.get("AWS_SES_REGION", "us-east-1")
SES_FROM_EMAIL = os.environ.get("SES_FROM_EMAIL", "")

# Google Calendar OAuth
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"]

# Avatar profiles: gender → {voice, label}. Images served via /api/public/avatar/{gender}.jpg (AI-generated at startup)
AVATAR_PROFILES = {
    "male": {"voice": "onyx", "label": "Male", "video": "https://videos.pexels.com/video-files/8419036/8419036-hd_1280_720_25fps.mp4"},
    "female": {"voice": "nova", "label": "Female", "video": "https://videos.pexels.com/video-files/6076988/6076988-uhd_2560_1440_25fps.mp4"},
    "neutral": {"voice": "sage", "label": "Neutral", "video": "https://videos.pexels.com/video-files/7580811/7580811-uhd_3840_2160_25fps.mp4"},
}
_avatar_cache = {}  # gender -> jpeg bytes

resend.api_key = RESEND_API_KEY

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

# ============= STORAGE =============
storage_key = None
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str):
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120)
    r.raise_for_status()
    return r.json()

# ============= HELPERS =============
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def gen_password(n=12):
    alph = string.ascii_letters + string.digits + "!@#$"
    return ''.join(secrets.choice(alph) for _ in range(n))

def make_token(user_id: str, role: str, impersonated_by: str = None) -> str:
    payload = {"sub": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    if impersonated_by:
        payload["impersonated_by"] = impersonated_by
        payload["exp"] = datetime.now(timezone.utc) + timedelta(hours=2)
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def log_audit(actor: dict, action: str, target: str = "", meta: dict = None):
    """Persist an audit event. actor is the current-user dict (may be impersonated)."""
    try:
        await db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "actor_id": actor.get("id") if actor else None,
            "actor_email": actor.get("email") if actor else None,
            "actor_role": actor.get("role") if actor else None,
            "impersonated_by": actor.get("_impersonated_by"),
            "action": action,
            "target": target,
            "meta": meta or {},
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning(f"audit log failed: {e}")

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or deactivated")
    user["_impersonated_by"] = payload.get("impersonated_by")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user

def send_email_sync(to: str, subject: str, html: str, from_override: str = None):
    """Send email. Prefer Amazon SES if configured, fallback to Resend."""
    sender = from_override or SES_FROM_EMAIL or SENDER_EMAIL
    # Try SES first
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and SES_FROM_EMAIL:
        try:
            ses = boto3.client("ses", region_name=AWS_SES_REGION, aws_access_key_id=AWS_ACCESS_KEY_ID, aws_secret_access_key=AWS_SECRET_ACCESS_KEY)
            ses.send_email(
                Source=sender,
                Destination={"ToAddresses": [to]},
                Message={"Subject": {"Data": subject}, "Body": {"Html": {"Data": html}}},
            )
            return True
        except Exception as e:
            logger.warning(f"SES send failed, falling back to Resend: {e}")
    # Fallback: Resend
    try:
        resend.Emails.send({"from": sender, "to": [to], "subject": subject, "html": html})
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False

def send_sms_sync(to: str, body: str):
    """Send SMS via Telnyx if configured."""
    if not (TELNYX_API_KEY and TELNYX_PHONE_NUMBER):
        return {"ok": False, "reason": "telnyx_not_configured"}
    try:
        m = telnyx.Message.create(from_=TELNYX_PHONE_NUMBER, to=to, text=body[:1600])
        return {"ok": True, "id": getattr(m, "id", None)}
    except Exception as e:
        logger.error(f"Telnyx SMS failed: {e}")
        return {"ok": False, "reason": str(e)[:120]}

async def send_sms(to: str, body: str):
    return await asyncio.to_thread(send_sms_sync, to, body)

async def send_email(to: str, subject: str, html: str):
    return await asyncio.to_thread(send_email_sync, to, subject, html)

# ============= BOOKING AVAILABILITY HELPERS =============
DEFAULT_BUSINESS_HOURS = {
    "mon": {"start": "09:00", "end": "17:00", "enabled": True},
    "tue": {"start": "09:00", "end": "17:00", "enabled": True},
    "wed": {"start": "09:00", "end": "17:00", "enabled": True},
    "thu": {"start": "09:00", "end": "17:00", "enabled": True},
    "fri": {"start": "09:00", "end": "17:00", "enabled": True},
    "sat": {"start": "10:00", "end": "14:00", "enabled": False},
    "sun": {"start": "10:00", "end": "14:00", "enabled": False},
}
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

def _parse_hm(s):
    try:
        parts = str(s).split(":")
        return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    except Exception:
        return 9, 0

def _slot_blocked(slot_start_utc: datetime, slot_end_utc: datetime, blocked_slots: list, recurring_blocks: list) -> bool:
    """Return True if the [slot_start_utc, slot_end_utc) window overlaps any block."""
    # One-off date blocks: {"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}
    for b in (blocked_slots or []):
        d = str(b.get("date", "")).strip()
        if not d:
            continue
        try:
            bs_h, bs_m = _parse_hm(b.get("start", "00:00"))
            be_h, be_m = _parse_hm(b.get("end", "23:59"))
            base = datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            b_start = base.replace(hour=bs_h, minute=bs_m)
            b_end = base.replace(hour=be_h, minute=be_m)
            if slot_start_utc < b_end and slot_end_utc > b_start:
                return True
        except Exception:
            continue
    # Weekly recurring: {"day":"friday","start":"HH:MM","end":"HH:MM"}
    day_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    for rb in (recurring_blocks or []):
        day = str(rb.get("day", "")).lower()
        wd = day_map.get(day)
        if wd is None:
            continue
        if slot_start_utc.weekday() != wd:
            continue
        try:
            bs_h, bs_m = _parse_hm(rb.get("start", "00:00"))
            be_h, be_m = _parse_hm(rb.get("end", "23:59"))
            b_start = slot_start_utc.replace(hour=bs_h, minute=bs_m, second=0, microsecond=0)
            b_end = slot_start_utc.replace(hour=be_h, minute=be_m, second=0, microsecond=0)
            if slot_start_utc < b_end and slot_end_utc > b_start:
                return True
        except Exception:
            continue
    return False

def _compute_available_slots(tenant: dict, days_ahead: int = 7, limit: int = 30) -> list:
    """Compute concrete available booking windows (UTC) for the next `days_ahead` days."""
    hours = tenant.get("business_hours") or DEFAULT_BUSINESS_HOURS
    duration = int(tenant.get("meeting_duration") or 30)
    blocked = tenant.get("blocked_slots") or []
    recurring = tenant.get("recurring_blocks") or []
    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    results = []
    for d in range(days_ahead):
        day_date = (now + timedelta(days=d)).date()
        wd = day_date.weekday()  # 0=Mon
        day_key = DAY_KEYS[wd]
        conf = hours.get(day_key) or {}
        if not conf.get("enabled", True):
            continue
        s_h, s_m = _parse_hm(conf.get("start", "09:00"))
        e_h, e_m = _parse_hm(conf.get("end", "17:00"))
        start = datetime.combine(day_date, datetime.min.time(), tzinfo=timezone.utc).replace(hour=s_h, minute=s_m)
        end = datetime.combine(day_date, datetime.min.time(), tzinfo=timezone.utc).replace(hour=e_h, minute=e_m)
        cur = start
        while cur + timedelta(minutes=duration) <= end:
            cur_end = cur + timedelta(minutes=duration)
            if cur >= now and not _slot_blocked(cur, cur_end, blocked, recurring):
                results.append({
                    "start_iso": cur.isoformat().replace("+00:00", "Z"),
                    "end_iso": cur_end.isoformat().replace("+00:00", "Z"),
                    "label": cur.strftime("%a %b %d, %I:%M %p UTC"),
                })
                if len(results) >= limit:
                    return results
            cur += timedelta(minutes=duration)
    return results

def _parse_slot_datetime(slot_text: str) -> Optional[datetime]:
    """Best-effort parse of freeform slot text -> UTC datetime."""
    from datetime import datetime as _dt
    import re as _re
    if not slot_text:
        return None
    # Try ISO first
    try:
        cleaned = slot_text.strip().rstrip("Z")
        return _dt.fromisoformat(cleaned).replace(tzinfo=timezone.utc)
    except Exception:
        pass
    sl = slot_text.lower()
    base = _dt.now(timezone.utc) + timedelta(days=1)
    if "today" in sl:
        base = _dt.now(timezone.utc)
    elif "next week" in sl:
        base = _dt.now(timezone.utc) + timedelta(days=7)
    hm = _re.search(r"(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?", sl)
    hour, minute = 15, 0
    if hm:
        try:
            hour = int(hm.group(1)); minute = int(hm.group(2) or 0)
            ampm = hm.group(3)
            if ampm == "pm" and hour < 12: hour += 12
            if ampm == "am" and hour == 12: hour = 0
            if hour > 23: hour = 15
        except Exception:
            hour, minute = 15, 0
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)

# ============= MODELS =============
class RegisterReq(BaseModel):
    full_name: str
    email: EmailStr
    target_domain: str

class LoginReq(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        # Trim surrounding whitespace and lowercase so trailing spaces / caps never block login
        return (v or "").strip().lower()

class ForgotReq(BaseModel):
    email: EmailStr

class ProfileUpdate(BaseModel):
    industry: Optional[str] = None
    custom_instruction: Optional[str] = None
    widget_bg: Optional[str] = None
    bubble_color: Optional[str] = None
    accent_color: Optional[str] = None
    active_slots: Optional[List[str]] = None
    spending_points: Optional[int] = None
    crawled_url: Optional[str] = None
    avatar_gender: Optional[str] = None
    avatar_background: Optional[str] = None  # studio_dark / office / clean_gradient
    business_owner_phone: Optional[str] = None
    custom_smtp_host: Optional[str] = None
    custom_smtp_user: Optional[str] = None
    custom_smtp_from: Optional[str] = None
    # Booking rules
    zoom_meeting_link: Optional[str] = None
    business_hours: Optional[dict] = None  # {"mon":{"start":"09:00","end":"17:00","enabled":true}, ...}
    meeting_duration: Optional[int] = None  # in minutes
    business_timezone: Optional[str] = None
    blocked_slots: Optional[List[dict]] = None  # [{"date":"2026-02-15","start":"14:00","end":"16:00","note":"..."}]
    recurring_blocks: Optional[List[dict]] = None  # [{"day":"friday","start":"15:00","end":"23:59"}]
    # Bot customization
    logo_url: Optional[str] = None
    bot_name: Optional[str] = None
    bot_greeting: Optional[str] = None
    bot_tone: Optional[str] = None  # professional | friendly | casual | luxury
    bot_tagline: Optional[str] = None
    # Notification / contact
    notification_email: Optional[str] = None
    # Order-tracking integration (Shopify)
    shopify_domain: Optional[str] = None  # e.g. myshop.myshopify.com
    shopify_admin_token: Optional[str] = None  # Admin API access token (shpat_...)

class AdminClientUpdate(BaseModel):
    """Full editable client fields for the admin Manage-Client screen."""
    full_name: Optional[str] = None
    target_domain: Optional[str] = None
    industry: Optional[str] = None
    custom_instruction: Optional[str] = None
    crawled_url: Optional[str] = None
    avatar_gender: Optional[str] = None
    avatar_background: Optional[str] = None
    widget_bg: Optional[str] = None
    bubble_color: Optional[str] = None
    accent_color: Optional[str] = None
    # per-client contact / notification
    notification_email: Optional[str] = None
    business_owner_phone: Optional[str] = None
    # per-client Google / Zoom
    google_email: Optional[str] = None
    zoom_meeting_link: Optional[str] = None
    # per-client SMTP override
    custom_smtp_host: Optional[str] = None
    custom_smtp_user: Optional[str] = None
    custom_smtp_pass: Optional[str] = None
    custom_smtp_from: Optional[str] = None
    # per-client 3rd-party keys
    resend_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    # Booking rules
    business_hours: Optional[dict] = None
    meeting_duration: Optional[int] = None
    business_timezone: Optional[str] = None
    blocked_slots: Optional[List[dict]] = None
    recurring_blocks: Optional[List[dict]] = None
    # Bot customization
    logo_url: Optional[str] = None
    bot_name: Optional[str] = None
    bot_greeting: Optional[str] = None
    bot_tone: Optional[str] = None
    bot_tagline: Optional[str] = None

class ChatReq(BaseModel):
    session_id: str
    message: str
    user_id: Optional[str] = None  # tenant id for sandbox

class BookingReq(BaseModel):
    slot: str
    customer_email: EmailStr
    tenant_id: str
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None

class EscalateReq(BaseModel):
    tenant_id: str
    transcript: List[dict]

class AdminCreateReq(BaseModel):
    email: EmailStr
    full_name: str
    target_domain: str = ""
    industry: str = "General Website"

class AdminUpdateInstructionReq(BaseModel):
    user_id: str
    custom_instruction: str

class SettingsToggle(BaseModel):
    public_signup_enabled: Optional[bool] = None
    upload_policy: Optional[str] = None  # 'admin_only' | 'client_self_serve'

# ============= STARTUP =============
@app.on_event("startup")
async def startup():
    init_storage()
    # Cache AI-generated portrait faces. Try fal.ai flux (photorealistic) first, fall back to dicebear SVG.
    prompts = {
        "male": "professional realistic photo of a friendly male AI concierge in his 30s, neutral background, soft studio lighting, clean look, portrait, high detail",
        "female": "professional realistic photo of a friendly female AI concierge in her 30s, neutral background, soft studio lighting, clean look, portrait, high detail",
        "neutral": "professional realistic photo of an androgynous AI concierge in their 30s, neutral background, soft studio lighting, clean look, portrait, high detail",
    }
    for g, prompt in prompts.items():
        image_bytes = None
        # Try fal.ai flux/schnell for realistic faces
        if FAL_KEY:
            try:
                result = await asyncio.to_thread(
                    lambda p=prompt: fal_client.subscribe(
                        "fal-ai/flux/schnell",
                        arguments={"prompt": p, "image_size": "portrait_4_3", "num_inference_steps": 4},
                        with_logs=False,
                    )
                )
                img_url = None
                if isinstance(result, dict):
                    images = result.get("images") or []
                    if images and isinstance(images[0], dict):
                        img_url = images[0].get("url")
                if img_url:
                    r = await asyncio.to_thread(lambda: requests.get(img_url, timeout=15))
                    if r.status_code == 200 and len(r.content) > 1000:
                        image_bytes = r.content
                        logger.info(f"fal.ai generated {g} avatar")
            except Exception as e:
                logger.warning(f"fal.ai avatar gen failed for {g}: {e}")
        # Fallback #1: OpenAI gpt-image-1 (works with Emergent LLM key)
        if not image_bytes and EMERGENT_LLM_KEY:
            try:
                gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
                imgs = await gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1, quality="low")
                if imgs and len(imgs[0]) > 1000:
                    image_bytes = imgs[0]
                    logger.info(f"OpenAI gpt-image-1 generated {g} avatar")
            except Exception as e:
                logger.warning(f"OpenAI gpt-image-1 failed for {g}: {e}")
        if image_bytes:
            _avatar_cache[g] = ("image/png", image_bytes)
        else:
            # Fallback #2: dicebear SVG (stable illustrated fallback)
            seed = {"male": "Concierge-Aiden", "female": "Concierge-Aria", "neutral": "Concierge-Nova"}[g]
            try:
                r = await asyncio.to_thread(lambda s=seed: requests.get(f"https://api.dicebear.com/9.x/personas/svg?seed={s}&backgroundColor=1A202C,2D3748&size=400", timeout=8))
                if r.status_code == 200:
                    _avatar_cache[g] = ("image/svg+xml", r.content)
                    logger.info(f"dicebear fallback for {g} avatar")
            except Exception as e:
                logger.warning(f"dicebear fallback failed for {g}: {e}")
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password": hash_pw(ADMIN_PASSWORD),
            "full_name": "Master Admin",
            "role": "admin",
            "active": True,
            "target_domain": "",
            "industry": "",
            "custom_instruction": "",
            "widget_bg": "#1A202C", "bubble_color": "#48BB78", "accent_color": "#48BB78",
            "active_slots": [], "spending_points": 0, "crawled_url": "",
            "created_at": now_iso(),
        })
    else:
        # Keep the master admin password in sync with .env and ensure it stays active
        existing_admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not check_pw(ADMIN_PASSWORD, existing_admin.get("password", "")):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password": hash_pw(ADMIN_PASSWORD), "active": True, "role": "admin"}})
    # Remove any stale admin accounts that are not the configured master admin
    await db.users.delete_many({"role": "admin", "email": {"$ne": ADMIN_EMAIL}})
    # Create MongoDB indexes for auth + audit
    try:
        await db.users.create_index("email", unique=True)
        await db.audit_logs.create_index([("created_at", -1)])
    except Exception as _e:
        logger.warning(f"index create warning: {_e}")
    # Seed demo client (reset password every startup so docs stay valid)
    demo_doc = {
            "id": str(uuid.uuid4()),
            "email": "demo@client.com",
            "password": hash_pw("Demo@12345"),
            "full_name": "Demo Client",
            "role": "client",
            "active": True,
            "target_domain": "https://demo-shop.example.com",
            "industry": "E-Commerce",
            "custom_instruction": "We are a modern DTC sneaker store selling premium running shoes with fast global shipping.",
            "widget_bg": "#1A202C", "bubble_color": "#48BB78", "accent_color": "#48BB78",
            "active_slots": [], "spending_points": 420, "crawled_url": "https://demo-shop.example.com/products",
            "created_at": now_iso(),
    }
    existing = await db.users.find_one({"email": "demo@client.com"})
    if not existing:
        await db.users.insert_one(demo_doc)
    else:
        await db.users.update_one({"email": "demo@client.com"}, {"$set": {"password": hash_pw("Demo@12345"), "active": True}})
    if not await db.settings.find_one({"id": "app_settings"}):
        await db.settings.insert_one({"id": "app_settings", "public_signup_enabled": True, "upload_policy": "client_self_serve"})
    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

# ============= PUBLIC =============
@api_router.get("/")
async def root():
    return {"app": "Rozio-Killer SaaS", "status": "ok"}

@api_router.get("/settings/public")
async def get_public_settings():
    s = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    return {
        "public_signup_enabled": s.get("public_signup_enabled", True) if s else True,
        "upload_policy": s.get("upload_policy", "client_self_serve") if s else "client_self_serve",
    }

@api_router.get("/public/tenant/{tenant_id}")
async def public_tenant(tenant_id: str):
    """Return SAFE tenant config for the embeddable widget. No auth required.
    Only exposes public-facing fields: bot identity, colors, catalog, greeting.
    Never returns email, phone, API keys, PDF contents, business hours, etc."""
    t = await db.users.find_one({"id": tenant_id, "active": True}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Widget disabled or tenant not found")
    return {
        "id": t["id"],
        "full_name": t.get("full_name") or "AI Concierge",
        "bot_name": t.get("bot_name") or "",
        "bot_tagline": t.get("bot_tagline") or "",
        "bot_greeting": t.get("bot_greeting") or "Hi! How can I help you today?",
        "bot_tone": t.get("bot_tone") or "friendly",
        "logo_url": t.get("logo_url") or "",
        "widget_bg": t.get("widget_bg") or "#1A202C",
        "bubble_color": t.get("bubble_color") or "#48BB78",
        "accent_color": t.get("accent_color") or "#48BB78",
        "avatar_gender": t.get("avatar_gender") or "female",
        "avatar_background": t.get("avatar_background") or "studio_dark",
        "catalog": (t.get("catalog") or [])[:8],
        "industry": t.get("industry") or "General Website",
    }

@api_router.get("/preview/proxy")
async def preview_proxy(url: str = Query(..., description="Full https URL to fetch and proxy for the live sandbox")):
    """Server-side fetch of a public URL so the live sandbox can embed sites that
    block iframes via X-Frame-Options / CSP. Rewrites <base> so relative asset
    URLs still resolve, strips frame-blocking headers, and injects a small
    banner so users know they're viewing a proxied preview."""
    import httpx
    from urllib.parse import urlparse, urljoin
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http(s)://")
    parsed = urlparse(url)
    if not parsed.netloc:
        raise HTTPException(400, "Invalid URL")
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; RozioKillerPreview/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }) as client:
            resp = await client.get(url)
        content_type = resp.headers.get("content-type", "text/html")
        # If it's not HTML, just return a placeholder page so the iframe doesn't fail hard
        if "html" not in content_type.lower():
            return Response(
                content=f"<html><body style='font-family:sans-serif;padding:40px;background:#1A202C;color:#fff'><h2>Non-HTML content ({content_type})</h2><p>{url}</p></body></html>",
                media_type="text/html",
            )
        html = resp.text
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        # Ensure <base> tag so relative URLs resolve to the ORIGIN (not our proxy)
        base_tag = f'<base href="{base_url}/">'
        if "<head" in html.lower():
            # Insert right after opening <head ...>
            import re as _re
            html = _re.sub(r"(<head[^>]*>)", r"\1" + base_tag, html, count=1, flags=_re.IGNORECASE)
        else:
            html = base_tag + html
        # Inject a small preview banner so users know
        banner = (
            "<div style='position:fixed;top:0;left:0;right:0;z-index:2147483646;"
            "background:linear-gradient(90deg,#48BB78,#38A169);color:#0D1117;"
            "padding:6px 14px;font:600 12px/1.4 system-ui,sans-serif;"
            "text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.25)'>"
            "&#10024; Rozio-Killer Live Sandbox &middot; proxied preview of "
            f"<b>{parsed.netloc}</b> &middot; the widget appears below-right</div>"
            "<div style='height:32px'></div>"
        )
        if "<body" in html.lower():
            import re as _re
            html = _re.sub(r"(<body[^>]*>)", r"\1" + banner, html, count=1, flags=_re.IGNORECASE)
        else:
            html = banner + html
        # Strip meta CSP that could block our banner/iframe context
        import re as _re
        html = _re.sub(
            r'<meta[^>]+http-equiv=["\']?content-security-policy["\']?[^>]*>',
            "", html, flags=_re.IGNORECASE,
        )
        # Return WITHOUT copying X-Frame-Options or CSP so our iframe can render
        return Response(content=html, media_type="text/html; charset=utf-8")
    except httpx.HTTPError as e:
        return Response(
            content=f"<html><body style='font-family:sans-serif;padding:40px;background:#1A202C;color:#fff'>"
                    f"<h2 style='color:#F56565'>Could not load preview</h2>"
                    f"<p style='color:#A0AEC0'>{url}</p>"
                    f"<p style='color:#A0AEC0;font-size:12px'>{str(e)[:200]}</p></body></html>",
            media_type="text/html", status_code=200,
        )

@api_router.post("/auth/register")
async def register(req: RegisterReq):
    s = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not (s and s.get("public_signup_enabled", True)):
        raise HTTPException(403, "Public signup is disabled. Contact admin for access.")
    email = req.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    pw = gen_password()
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": hash_pw(pw),
        "full_name": req.full_name,
        "target_domain": req.target_domain,
        "role": "client",
        "active": True,
        "industry": "General Website",
        "custom_instruction": "",
        "widget_bg": "#1A202C", "bubble_color": "#48BB78", "accent_color": "#48BB78",
        "active_slots": [], "spending_points": 0, "crawled_url": "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Welcome to Rozio-Killer, {req.full_name}!</h2>
    <p>Your account is verified. Login with these credentials:</p>
    <p><b>Email:</b> {req.email}<br><b>Temporary Password:</b> <code style='background:#2D3748;padding:4px 8px'>{pw}</code></p>
    <p>Domain onboarded: {req.target_domain}</p>
    </div>
    """
    await send_email(req.email, "Welcome to Rozio-Killer - Account Verified", html)
    return {"ok": True, "message": "Verification email sent with login credentials.", "email_preview_password": pw}

@api_router.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not check_pw(req.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    if not user.get("active", True):
        raise HTTPException(403, "Account deactivated")
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "role": user["role"], "full_name": user["full_name"]}}

@api_router.post("/auth/forgot")
async def forgot(req: ForgotReq):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if user:
        new_pw = gen_password()
        await db.users.update_one({"id": user["id"]}, {"$set": {"password": hash_pw(new_pw)}})
        html = f"""
        <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
        <h2 style='color:#48BB78'>Password Reset</h2>
        <p>Your new temporary password: <code style='background:#2D3748;padding:4px 8px'>{new_pw}</code></p>
        <p>Please login and change it immediately.</p>
        </div>
        """
        await send_email(req.email, "Rozio-Killer - Password Reset", html)
    return {"ok": True, "message": "If the email exists, a reset was sent."}

# ============= CLIENT DASHBOARD =============
@api_router.get("/me")
async def me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password"}

@api_router.put("/me/profile")
async def update_profile(req: ProfileUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return {"ok": True}

@api_router.post("/me/logo")
async def upload_logo(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a bot/business logo. Stored in Emergent Object Storage.
    Returns a *public* backend proxy URL (browsers cannot hit the storage service
    directly because it requires an X-Storage-Key header)."""
    fname = (file.filename or "").lower()
    if not any(fname.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".svg"]):
        raise HTTPException(400, "Only PNG, JPG, WEBP, or SVG allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Logo must be under 5MB")
    ext = fname.rsplit(".", 1)[-1]
    path = f"{APP_NAME}/logos/{user['id']}/{uuid.uuid4()}.{ext}"
    ct_map = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "svg": "image/svg+xml"}
    content_type = ct_map.get(ext, "application/octet-stream")
    put_object(path, data, content_type)
    # Save storage-side path + content type; return a public backend URL that
    # streams the object with cache-busting version.
    version = uuid.uuid4().hex[:8]
    public_url = f"/api/public/logo/{user['id']}?v={version}"
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "logo_url": public_url,
        "logo_storage_path": path,
        "logo_content_type": content_type,
    }})
    return {"ok": True, "logo_url": public_url}

@api_router.delete("/me/logo")
async def delete_logo(user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"logo_url": "", "logo_storage_path": "", "logo_content_type": ""}})
    return {"ok": True}

@api_router.get("/public/logo/{tenant_id}")
async def public_logo(tenant_id: str):
    """Publicly serve a tenant's uploaded logo. Fetches from Emergent Object
    Storage using our server-side X-Storage-Key, streams the bytes back so any
    <img> tag can render it (used by the widget header + dashboard preview)."""
    t = await db.users.find_one({"id": tenant_id})
    if not t or not t.get("logo_storage_path"):
        raise HTTPException(404, "No logo")
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage unavailable")
    try:
        r = requests.get(
            f"{STORAGE_URL}/objects/{t['logo_storage_path']}",
            headers={"X-Storage-Key": key},
            timeout=30,
        )
        r.raise_for_status()
    except Exception as e:
        logger.error(f"Fetch logo failed: {e}")
        raise HTTPException(502, "Logo fetch failed")
    return Response(
        content=r.content,
        media_type=t.get("logo_content_type") or "image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )

@api_router.post("/knowledge/upload")
async def upload_pdf(file: UploadFile = File(...), user=Depends(get_current_user)):
    # Enforce upload policy
    s = await db.settings.find_one({"id": "app_settings"}, {"_id": 0}) or {}
    policy = s.get("upload_policy", "client_self_serve")
    if policy == "admin_only" and user.get("role") != "admin":
        raise HTTPException(403, "Uploads are restricted to admins by policy")
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files allowed")
    ext = "pdf"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, "application/pdf")
    # Extract text for RAG
    text = ""
    try:
        reader = PdfReader(BytesIO(data))
        for page in reader.pages[:30]:  # first 30 pages
            text += (page.extract_text() or "") + "\n"
        text = text[:30000]  # cap for prompt safety
    except Exception as e:
        logger.warning(f"PDF extract failed: {e}")
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "storage_path": result["path"],
        "original_filename": file.filename,
        "size": result["size"],
        "content": text,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(rec.copy())
    # Response without heavy content
    return {k: v for k, v in rec.items() if k != "content"}

@api_router.get("/knowledge/files")
async def list_files(user=Depends(get_current_user)):
    target_id = user["id"]
    files = await db.files.find({"user_id": target_id, "is_deleted": False}, {"_id": 0}).to_list(200)
    return files

@api_router.post("/knowledge/crawl")
async def crawl_url(payload: dict, user=Depends(get_current_user)):
    url = (payload.get("url") or "").strip()
    if not url.startswith("http"):
        raise HTTPException(400, "Provide a valid URL starting with http/https")
    try:
        r = await asyncio.to_thread(lambda: requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 (Rozio-Killer Crawler)"}))
        r.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Fetch failed: {e}")
    soup = BeautifulSoup(r.text, "lxml")
    title = (soup.title.string if soup.title else url).strip()
    meta_desc = ""
    md = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    if md and md.get("content"):
        meta_desc = md["content"][:400]
    for s in soup(["script", "style", "noscript"]):
        s.decompose()
    body_text = " ".join(soup.get_text(" ").split())[:8000]
    imgs = []
    prod_urls = []
    from urllib.parse import urljoin
    for img in soup.find_all("img")[:80]:
        src = img.get("src") or img.get("data-src")
        if not src: continue
        if src.startswith("//"): src = "https:" + src
        elif src.startswith("/"): src = urljoin(url, src)
        if not (src.startswith("http") and any(ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"])):
            continue
        if src in imgs:
            continue
        # find enclosing anchor to associate a product url
        a = img.find_parent("a")
        href = a.get("href") if a and a.get("href") else None
        if href:
            if href.startswith("//"): href = "https:" + href
            elif href.startswith("/"): href = urljoin(url, href)
            elif not href.startswith("http"): href = urljoin(url, href)
        prod_url = href if href and href.startswith("http") else url
        imgs.append(src)
        prod_urls.append(prod_url)
        if len(imgs) >= 10: break
    system = (
        "You are a web-page extractor. Given HTML text content from a business website, extract 3-6 top items "
        "(products for e-commerce, services for local business, or key offerings for general sites). "
        "Return STRICTLY valid JSON only, no prose, no markdown fences, in this exact format: "
        '{"kind":"product|service|offering","items":[{"name":"...","price":"$X or Contact","description":"one line"}], "delivery":{"US":"...","EU":"...","APAC":"..."}}'
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"crawl-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-4o")
    user_msg = f"URL: {url}\nTitle: {title}\nDescription: {meta_desc}\n\nContent:\n{body_text[:6000]}"
    raw = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=user_msg)):
            if isinstance(ev, TextDelta):
                raw += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.error(f"LLM extract failed: {e}")
    import re as _re
    m = _re.search(r"\{[\s\S]*\}", raw)
    parsed = {}
    if m:
        try:
            parsed = json.loads(m.group(0))
        except Exception:
            parsed = {}
    items = parsed.get("items") or []
    for i, it in enumerate(items):
        it["image"] = imgs[i] if i < len(imgs) else (imgs[0] if imgs else "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?w=400")
        it["url"] = prod_urls[i] if i < len(prod_urls) else url
        it["price"] = it.get("price", "Contact for pricing")
    delivery = parsed.get("delivery") or {"US": "3-5 business days", "EU": "5-8 business days", "APAC": "7-12 business days"}
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "crawled_url": url, "catalog": items, "delivery": delivery, "site_title": title, "site_description": meta_desc
    }})
    return {"ok": True, "products": items, "delivery": delivery, "title": title, "description": meta_desc, "kind": parsed.get("kind", "offering")}

# ============= CHAT (SSE STREAM) =============
@api_router.post("/chat/stream")
async def chat_stream(req: ChatReq):
    tenant_id = req.user_id
    tenant = await db.users.find_one({"id": tenant_id}, {"_id": 0}) if tenant_id else None
    industry = tenant.get("industry", "General Website") if tenant else "General Website"
    instruction = tenant.get("custom_instruction", "") if tenant else ""
    catalog = tenant.get("catalog", []) if tenant else []
    delivery = tenant.get("delivery", {}) if tenant else {}

    system = (
        f"You are a warm, natural-sounding human-like AI concierge for a {industry} business. "
        f"Business context: {instruction or 'No custom context.'} "
        f"Site title: {tenant.get('site_title','') if tenant else ''}. "
        f"Site description: {tenant.get('site_description','') if tenant else ''}. "
        f"\n\n=== ABSOLUTE RULES (violation ruins the experience) ==="
        f"\n1. The visitor has ALREADY been greeted by the widget interface with 'Hey — how can I help?'. NEVER greet them again. NEVER open a reply with 'Hi', 'Hello', 'Hey', 'Hey there', 'How can I help', 'How can I assist', 'How are you doing', 'Good to see you', or ANY variant. Jump STRAIGHT into the answer or clarifying question on your very first reply and every reply after."
        f"\n2. NEVER repeat yourself. Do not restate what you just said. Do not restate the visitor's question back to them. Do not paraphrase your last message."
        f"\n3. Remember the full conversation. Reference earlier context specifically (e.g. 'the iPhone you mentioned', 'the size 10 you asked about'). Never ask for information the visitor already gave."
        f"\n4. Be genuinely useful. Every reply must move the conversation forward: give an answer, ask ONE precise clarifying question, or take an action. No filler acknowledgements like 'Sure thing!', 'Of course!', 'Absolutely!' on their own."
        f"\n5. Voice-friendly length: 1-2 short sentences by default. Never more than 3 unless the visitor asks for detail. Use natural contractions (I'll, you're, that's)."
        f"\n6. Auto-detect the visitor's language from EVERY message and ALWAYS reply in that same language."
        f"\n\nLANGUAGE MARKER (VERY IMPORTANT): At the very start of EVERY reply, emit EXACTLY '[[LANG:xx]]' where xx is the 2-letter ISO 639-1 code of the language you are about to reply in (en, es, fr, de, it, pt, ja, zh, ar, hi, ko, ru, nl, sv, pl, tr, etc). Do NOT emit any other text before the marker. "
        f"\n\nSPECIAL ACTIONS - VERY IMPORTANT: "
        f"When the user asks to speak with a human, agent, representative, or wants escalation, "
        f"first give a short acknowledgement (1 sentence), then emit EXACTLY this marker on its own line: [[ACTION:escalate]] "
        f"When the user asks to book/schedule/reserve an appointment/slot, first confirm date+time, "
        f"then emit EXACTLY: [[ACTION:book:<slot description>]] "
        f"Only emit action markers when the user explicitly requests these; never volunteer them. "
    )
    # Inject full site catalog so the AI can actively sell/book from real inventory
    catalog_lines = []
    if catalog:
        for p in catalog[:10]:
            catalog_lines.append(f"- {p.get('name','')} | {p.get('price','')} | url: {p.get('url','')} | {p.get('description','')} | image: {p.get('image','')}")
    if catalog_lines:
        system += (
            "\n\n=== LIVE SITE INVENTORY (use these real items when the user asks about products/services/pricing) ===\n"
            + "\n".join(catalog_lines)
            + "\n\nWhen recommending an item, mention name+price naturally. When the visitor expresses buying intent (e.g. 'I'll take it', 'buy', 'add to cart'), emit EXACTLY this marker on its own line: [[BUY:<product name>|<product url>]] using the exact url from the inventory above. Never invent URLs. "
        )
    if delivery:
        system += f"\nDelivery windows: {json.dumps(delivery)}. When asked about shipping/timeline by region, cite these accurately. "

    # Per-tenant Zoom link (share when scheduling video calls)
    zoom_link = tenant.get("zoom_meeting_link", "") if tenant else ""
    if zoom_link:
        system += f"\n\nZoom meeting link for this business: {zoom_link}. When the visitor books a meeting or asks how to join, include this link naturally in your reply so they know where the call happens. "

    # Per-tenant booking rules — compute real available windows so AI never offers a blocked time
    if tenant:
        try:
            _slots = _compute_available_slots(tenant, days_ahead=7, limit=12)
        except Exception:
            _slots = []
        _duration = int(tenant.get("meeting_duration") or 30)
        _tz = tenant.get("business_timezone") or "UTC"
        if _slots:
            _lines = "\n".join([f"- {s['label']} (ISO: {s['start_iso']})" for s in _slots[:12]])
            system += (
                f"\n\n=== BOOKING RULES ==="
                f"\nMeeting length: {_duration} minutes. Timezone: {_tz}."
                f"\nOnly ever offer slots from this list of currently-available windows (already filters out blocked/off-hours times):"
                f"\n{_lines}"
                f"\nWhen the visitor confirms a slot, emit EXACTLY: [[ACTION:book:<ISO start of chosen slot>]] using the ISO value above. Never invent times outside this list."
            )
        else:
            system += (
                "\n\n=== BOOKING RULES ==="
                "\nNo bookable slots are currently open. If the visitor asks to book, apologise briefly and offer to take their email so the business will reach out."
            )

    # Bot persona / tone customisation
    if tenant:
        _tone = (tenant.get("bot_tone") or "friendly").lower()
        _bot_name = tenant.get("bot_name") or tenant.get("full_name") or ""
        tone_map = {
            "professional": "Speak clearly and courteously with a polished business tone. Use complete sentences, avoid slang.",
            "friendly": "Speak warmly and conversationally, like a helpful friend. Feel free to use light contractions.",
            "casual": "Speak in a relaxed, upbeat casual tone. Short sentences, natural contractions, playful when it fits.",
            "luxury": "Speak with quiet confidence and understated sophistication, as if concierge at a five-star hotel. Never gushy.",
        }
        system += f"\n\nBOT PERSONA: You are called {_bot_name or 'the AI concierge'}. Tone: {tone_map.get(_tone, tone_map['friendly'])}"

    # RAG: inject PDF knowledge context
    if tenant_id:
        pdf_files = await db.files.find({"user_id": tenant_id, "is_deleted": False}, {"_id": 0, "content": 1, "original_filename": 1}).to_list(5)
        pdf_chunks = []
        for f in pdf_files:
            if f.get("content"):
                pdf_chunks.append(f"[Source: {f.get('original_filename', 'pdf')}]\n{f['content'][:6000]}")
        if pdf_chunks:
            system += "\n\n=== INTERNAL KNOWLEDGE BASE (cite when relevant) ===\n" + "\n\n---\n\n".join(pdf_chunks)

    # Training corrections: business-approved answers override the AI's default phrasing
    if tenant_id:
        corrections = await db.training_corrections.find({"user_id": tenant_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
        if corrections:
            lines = []
            for c in corrections:
                q = (c.get("question") or "").strip()
                a = (c.get("corrected") or "").strip()
                if a:
                    lines.append(f"- If the visitor asks about \"{q or 'this topic'}\", answer with: {a}")
            if lines:
                system += (
                    "\n\n=== APPROVED ANSWERS (highest priority — the business has explicitly approved these responses, prefer them over your own) ===\n"
                    + "\n".join(lines)
                )

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=req.session_id, system_message=system).with_model("openai", "gpt-4o")

    # increment chats counter
    if tenant_id:
        await db.metrics.update_one({"tenant_id": tenant_id}, {"$inc": {"chats": 1}}, upsert=True)

    # Persist inbound message + upsert conversation record for the Messages inbox
    conv_status = "ai"
    if tenant_id:
        _now = now_iso()
        existing = await db.conversations.find_one({"session_id": req.session_id, "tenant_id": tenant_id})
        if existing:
            conv_status = existing.get("status", "ai")
        await db.conversations.update_one(
            {"session_id": req.session_id, "tenant_id": tenant_id},
            {
                "$setOnInsert": {"id": str(uuid.uuid4()), "session_id": req.session_id, "tenant_id": tenant_id, "created_at": _now, "status": "ai"},
                "$set": {"last_message": req.message[:200], "last_at": _now},
                "$inc": {"msg_count": 1},
            },
            upsert=True,
        )
        await db.messages.insert_one({"id": str(uuid.uuid4()), "session_id": req.session_id, "tenant_id": tenant_id, "role": "user", "text": req.message, "created_at": _now})

    # If the business owner has taken over this conversation, do NOT run the LLM.
    # Emit a soft holding message so the visitor knows a human is on it.
    if conv_status == "human":
        async def hold_gen():
            hold = "A team member is on this chat and will reply shortly."
            yield f"data: {json.dumps({'delta': hold})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        return StreamingResponse(hold_gen(), media_type="text/event-stream")

    async def gen():
        acc_reply = ""
        try:
            async for ev in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(ev, TextDelta):
                    acc_reply += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Chat error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        # Persist AI reply (strip markers for cleaner inbox)
        if tenant_id and acc_reply:
            _clean = acc_reply
            for _pat in [r"\[\[LANG:[a-z]{2}\]\]", r"\[\[ACTION:[^\]]+\]\]", r"\[\[BUY:[^\]]+\]\]"]:
                import re as _re
                _clean = _re.sub(_pat, "", _clean, flags=_re.IGNORECASE)
            _clean = _clean.strip()
            _now2 = now_iso()
            await db.messages.insert_one({"id": str(uuid.uuid4()), "session_id": req.session_id, "tenant_id": tenant_id, "role": "assistant", "text": _clean, "created_at": _now2})
            await db.conversations.update_one(
                {"session_id": req.session_id, "tenant_id": tenant_id},
                {"$set": {"last_reply": _clean[:200], "last_at": _now2}, "$inc": {"msg_count": 1}},
            )

    return StreamingResponse(gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@api_router.post("/chat/escalate")
async def escalate(req: EscalateReq):
    tenant = await db.users.find_one({"id": req.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    lines = "".join([f"<p><b style='color:#48BB78'>{m['role']}:</b> {m['text']}</p>" for m in req.transcript])
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Live Human Escalation - Transcript</h2>
    <p>A customer requested to speak with a live agent on <b>{tenant.get('target_domain', 'your site')}</b>.</p>
    <div style='background:#2D3748;padding:16px;border-radius:6px'>{lines}</div>
    <p style='margin-top:16px'>Automated phone fallback trigger: <b>+1-555-ROZIO-AI</b></p>
    </div>
    """
    await send_email(tenant["email"], "Live Human Escalation - Chat Transcript", html)
    # Telnyx Call Control transfer (preferred) → Twilio fallback → mocked log
    call_status = "mocked"
    call_sid = None
    call_provider = "mock"
    business_phone = tenant.get("business_owner_phone") or TELNYX_BUSINESS_OWNER_PHONE or ESCALATION_TARGET
    if TELNYX_API_KEY and TELNYX_PHONE_NUMBER and business_phone:
        try:
            def _telnyx_call():
                return telnyx.Call.create(
                    connection_id=os.environ.get("TELNYX_CONNECTION_ID", ""),
                    to=business_phone,
                    from_=TELNYX_PHONE_NUMBER,
                    audio_url=None,
                )
            call = await asyncio.to_thread(_telnyx_call)
            call_sid = getattr(call, "call_control_id", None) or getattr(call, "id", None)
            call_status = "live_call_placed"
            call_provider = "telnyx"
        except Exception as e:
            logger.error(f"Telnyx call failed: {e}")
            call_status = f"telnyx_failed: {str(e)[:60]}"
    elif (TWILIO_SID and (TWILIO_TOKEN or (TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET))) and TWILIO_FROM and business_phone:
        try:
            tw = _twilio_client()
            c = tw.calls.create(to=business_phone, from_=TWILIO_FROM,
                twiml=f"<Response><Say voice='Polly.Joanna'>Live human escalation from Rozio Killer. A customer on {tenant.get('target_domain', 'your site')} is waiting.</Say></Response>")
            call_sid = c.sid
            call_status = "live_call_placed"
            call_provider = "twilio"
        except Exception as e:
            logger.error(f"Twilio call failed: {e}")
            call_status = f"twilio_failed: {str(e)[:60]}"
    # SMS lead alert if Telnyx configured
    if TELNYX_API_KEY and TELNYX_PHONE_NUMBER and business_phone:
        await send_sms(business_phone, f"Rozio-Killer: High-intent lead escalation from {tenant.get('target_domain','your site')}. Check email for transcript.")
    await db.calls.insert_one({"id": str(uuid.uuid4()), "tenant_id": req.tenant_id, "target": business_phone, "status": call_status, "sid": call_sid, "provider": call_provider, "created_at": now_iso()})
    await db.metrics.update_one({"tenant_id": req.tenant_id}, {"$inc": {"escalations": 1}}, upsert=True)
    return {"ok": True, "status": "Routing to Live Line...", "phone": business_phone or "+1-555-ROZIO-AI", "call_status": call_status, "call_sid": call_sid, "provider": call_provider}

@api_router.post("/booking/confirm")
async def booking_confirm(req: BookingReq):
    tenant = await db.users.find_one({"id": req.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    # Parse slot to a real datetime and validate against blocks
    start_utc = _parse_slot_datetime(req.slot) or (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=15, minute=0, second=0, microsecond=0)
    duration = int(tenant.get("meeting_duration") or 30)
    end_utc = start_utc + timedelta(minutes=duration)
    # Enforce business rules
    if _slot_blocked(start_utc, end_utc, tenant.get("blocked_slots") or [], tenant.get("recurring_blocks") or []):
        raise HTTPException(400, "That time is blocked. Please choose another slot.")
    # Enforce business hours if configured
    hours = tenant.get("business_hours") or DEFAULT_BUSINESS_HOURS
    day_key = DAY_KEYS[start_utc.weekday()]
    conf = hours.get(day_key) or {}
    if not conf.get("enabled", True):
        raise HTTPException(400, "Bookings are closed on that day.")
    s_h, s_m = _parse_hm(conf.get("start", "09:00"))
    e_h, e_m = _parse_hm(conf.get("end", "17:00"))
    open_at = start_utc.replace(hour=s_h, minute=s_m, second=0, microsecond=0)
    close_at = start_utc.replace(hour=e_h, minute=e_m, second=0, microsecond=0)
    if start_utc < open_at or end_utc > close_at:
        raise HTTPException(400, f"Outside business hours ({conf.get('start')}–{conf.get('end')}). Please pick a slot within business hours.")

    fmt = "%Y%m%dT%H%M%SZ"
    dates = f"{start_utc.strftime(fmt)}/{end_utc.strftime(fmt)}"
    biz_name = tenant.get("bot_name") or tenant.get("full_name") or "Business"
    title = f"Appointment with {biz_name}"
    details = f"Slot: {req.slot}. Booked via {biz_name} AI concierge."
    location = tenant.get("target_domain", "")
    gcal_url = (
        "https://www.google.com/calendar/render?action=TEMPLATE"
        f"&text={urlquote(title)}"
        f"&dates={dates}"
        f"&details={urlquote(details)}"
        f"&location={urlquote(location)}"
        f"&add={urlquote(req.customer_email)}"
    )
    booking = {
        "id": str(uuid.uuid4()), "tenant_id": req.tenant_id, "slot": req.slot,
        "customer_email": req.customer_email, "customer_phone": req.customer_phone,
        "customer_name": req.customer_name,
        "start_iso": start_utc.isoformat().replace("+00:00", "Z"),
        "end_iso": end_utc.isoformat().replace("+00:00", "Z"),
        "google_calendar_url": gcal_url, "created_at": now_iso(),
    }
    await db.bookings.insert_one(booking.copy())
    zoom_link = tenant.get("zoom_meeting_link", "") or ""
    zoom_block = ""
    if zoom_link:
        zoom_block = f"<p><b>Zoom Meeting:</b> <a href='{zoom_link}' style='color:#48BB78'>{zoom_link}</a></p>"
    pretty_time = start_utc.strftime("%A, %b %d at %I:%M %p UTC")
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Appointment Confirmed</h2>
    <p>Your booking with <b>{biz_name}</b> is confirmed.</p>
    <p><b>When:</b> {pretty_time}<br><b>Duration:</b> {duration} minutes</p>
    <p><b>Requested:</b> {req.slot}</p>
    {zoom_block}
    <p><a href='{gcal_url}' style='display:inline-block;background:#48BB78;color:#1A202C;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold'>Add to Google Calendar</a></p>
    </div>
    """
    await send_email(req.customer_email, "Appointment Confirmed", html)
    await send_email(tenant["email"], "New Booking Received", html)
    # Optional secondary notification email (business ops mailbox)
    notif = (tenant.get("notification_email") or "").strip()
    if notif and notif.lower() != tenant["email"].lower():
        await send_email(notif, "New Booking Received", html)
    # Try Google Calendar event creation if tenant has OAuth linked
    gcal_event_id = None
    if tenant.get("google_refresh_token") and GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
        try:
            creds = GoogleCreds(
                token=None,
                refresh_token=tenant["google_refresh_token"],
                token_uri="https://oauth2.googleapis.com/token",
                client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET, scopes=GOOGLE_SCOPES,
            )
            def _create_event():
                service = gapi_build("calendar", "v3", credentials=creds, cache_discovery=False)
                event = {
                    "summary": title,
                    "description": details + (f"\nZoom: {zoom_link}" if zoom_link else ""),
                    "start": {"dateTime": start_utc.isoformat().replace("+00:00", "Z")},
                    "end": {"dateTime": end_utc.isoformat().replace("+00:00", "Z")},
                    "attendees": [{"email": req.customer_email}],
                }
                if zoom_link:
                    event["location"] = zoom_link
                return service.events().insert(calendarId="primary", body=event, sendUpdates="all").execute()
            ev = await asyncio.to_thread(_create_event)
            gcal_event_id = ev.get("id")
        except Exception as e:
            logger.error(f"Google Calendar create failed: {e}")
    # SMS lead alert to business owner
    biz_phone = tenant.get("business_owner_phone") or TELNYX_BUSINESS_OWNER_PHONE
    if TELNYX_API_KEY and TELNYX_PHONE_NUMBER and biz_phone:
        await send_sms(biz_phone, f"New booking with {biz_name}: {pretty_time} - {req.customer_email}")
    # SMS confirmation to customer if phone provided
    if TELNYX_API_KEY and TELNYX_PHONE_NUMBER and req.customer_phone:
        zoom_bit = f" Zoom: {zoom_link}" if zoom_link else ""
        await send_sms(req.customer_phone, f"Confirmed! Your appointment with {biz_name} is {pretty_time}.{zoom_bit}")
    await db.metrics.update_one({"tenant_id": req.tenant_id}, {"$inc": {"bookings": 1}}, upsert=True)
    return {"ok": True, "booking": booking, "google_calendar_url": gcal_url, "google_event_id": gcal_event_id, "zoom_link": zoom_link, "start_iso": booking["start_iso"], "end_iso": booking["end_iso"]}

@api_router.get("/booking/available-slots")
async def booking_available_slots(tenant_id: str = Query(...), days: int = Query(7)):
    tenant = await db.users.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    slots = _compute_available_slots(tenant, days_ahead=min(max(days, 1), 30), limit=30)
    return {"ok": True, "slots": slots, "meeting_duration": int(tenant.get("meeting_duration") or 30)}

# ============= ADMIN =============
@api_router.put("/admin/settings")
async def admin_toggle(req: SettingsToggle, admin=Depends(require_admin)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        await db.settings.update_one({"id": "app_settings"}, {"$set": updates}, upsert=True)
    await log_audit(admin, "settings.update", "app_settings", updates)
    return {"ok": True}

@api_router.get("/admin/users")
async def admin_list(admin=Depends(require_admin)):
    users = await db.users.find({"role": "client"}, {"_id": 0, "password": 0}).to_list(500)
    return users

@api_router.post("/admin/users/create")
async def admin_create(req: AdminCreateReq, admin=Depends(require_admin)):
    email = req.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    pw = gen_password()
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": hash_pw(pw),
        "full_name": req.full_name,
        "target_domain": req.target_domain,
        "role": "client",
        "active": True,
        "industry": req.industry,
        "custom_instruction": "",
        "widget_bg": "#1A202C", "bubble_color": "#48BB78", "accent_color": "#48BB78",
        "active_slots": [], "spending_points": 0, "crawled_url": "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await log_audit(admin, "client.create", email)
    return {"ok": True, "email": email, "temporary_password": pw}

@api_router.post("/admin/users/{user_id}/deactivate")
async def admin_deactivate(user_id: str, admin=Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    await log_audit(admin, "client.deactivate", user_id)
    return {"ok": True}

@api_router.post("/admin/users/{user_id}/activate")
async def admin_activate(user_id: str, admin=Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"active": True}})
    await log_audit(admin, "client.activate", user_id)
    return {"ok": True}

@api_router.post("/admin/users/{user_id}/forgot")
async def admin_send_forgot(user_id: str, admin=Depends(require_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Not found")
    new_pw = gen_password()
    await db.users.update_one({"id": user_id}, {"$set": {"password": hash_pw(new_pw)}})
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Password Reset by Admin</h2>
    <p>New temporary password: <code style='background:#2D3748;padding:4px 8px'>{new_pw}</code></p>
    </div>
    """
    await send_email(user["email"], "Password Reset by Admin", html)
    return {"ok": True}

@api_router.put("/admin/users/{user_id}/instruction")
async def admin_update_instruction(user_id: str, req: AdminUpdateInstructionReq, admin=Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"custom_instruction": req.custom_instruction}})
    await log_audit(admin, "client.instruction", user_id)
    return {"ok": True}

@api_router.put("/admin/users/{user_id}")
async def admin_update_client(user_id: str, req: AdminClientUpdate, admin=Depends(require_admin)):
    """Admin edits any editable field on a client's profile in one shot."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Client not found")
    if target.get("role") == "admin":
        raise HTTPException(403, "Cannot edit admin from this endpoint")
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True, "updated": 0}
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await log_audit(admin, "client.update", target.get("email", user_id), {"fields": list(updates.keys())})
    return {"ok": True, "updated": len(updates), "fields": list(updates.keys())}

@api_router.get("/admin/users/{user_id}")
async def admin_get_client(user_id: str, admin=Depends(require_admin)):
    """Full client profile for the admin Manage-Client screen."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(404, "Client not found")
    return u

@api_router.get("/admin/users/{user_id}/files")
async def admin_user_files(user_id: str, admin=Depends(require_admin)):
    files = await db.files.find({"user_id": user_id, "is_deleted": False}, {"_id": 0}).to_list(200)
    return files

@api_router.post("/admin/users/{user_id}/files/upload")
async def admin_upload_for_user(user_id: str, file: UploadFile = File(...), admin=Depends(require_admin)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files allowed")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.pdf"
    data = await file.read()
    result = put_object(path, data, "application/pdf")
    text = ""
    try:
        reader = PdfReader(BytesIO(data))
        for page in reader.pages[:30]:
            text += (page.extract_text() or "") + "\n"
        text = text[:30000]
    except Exception as e:
        logger.warning(f"PDF extract failed: {e}")
    rec = {"id": str(uuid.uuid4()), "user_id": user_id, "storage_path": result["path"],
           "original_filename": file.filename, "size": result["size"], "content": text,
           "is_deleted": False, "created_at": now_iso(), "uploaded_by_admin": True}
    await db.files.insert_one(rec.copy())
    return {k: v for k, v in rec.items() if k != "content"}

@api_router.delete("/admin/files/{file_id}")
async def admin_delete_file(file_id: str, admin=Depends(require_admin)):
    r = await db.files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    if r.matched_count == 0:
        raise HTTPException(404, "File not found")
    return {"ok": True}

# ============= GOOGLE CALENDAR OAUTH =============
def _google_flow(redirect_uri: str):
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        raise HTTPException(400, "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env")
    return Flow.from_client_config(
        {"web": {
            "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }},
        scopes=GOOGLE_SCOPES, redirect_uri=redirect_uri,
    )

@api_router.get("/google/oauth/start")
async def google_oauth_start(user=Depends(get_current_user)):
    flow = _google_flow(GOOGLE_REDIRECT_URI)
    state_token = f"{user['id']}.{secrets.token_urlsafe(16)}"
    await db.oauth_states.insert_one({"id": state_token, "user_id": user["id"], "created_at": now_iso()})
    auth_url, _ = flow.authorization_url(access_type="offline", include_granted_scopes="true", prompt="consent", state=state_token)
    return {"auth_url": auth_url}

@api_router.get("/google/oauth/callback")
async def google_oauth_callback(code: str = Query(...), state: str = Query(...)):
    st = await db.oauth_states.find_one({"id": state}, {"_id": 0})
    if not st:
        raise HTTPException(400, "Invalid state")
    flow = _google_flow(GOOGLE_REDIRECT_URI)
    try:
        await asyncio.to_thread(lambda: flow.fetch_token(code=code))
    except Exception as e:
        raise HTTPException(400, f"OAuth failed: {e}")
    creds = flow.credentials
    if not creds.refresh_token:
        raise HTTPException(400, "No refresh_token returned. Revoke access in Google account and retry.")
    await db.users.update_one({"id": st["user_id"]}, {"$set": {
        "google_refresh_token": creds.refresh_token,
        "google_connected_at": now_iso(),
    }})
    await db.oauth_states.delete_one({"id": state})
    frontend = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or ""
    return Response(content=f"<html><body style='background:#1A202C;color:#fff;font-family:sans-serif;padding:40px;text-align:center'><h2 style='color:#48BB78'>Google Calendar connected!</h2><p>You can close this tab.</p><script>setTimeout(()=>{{window.close();window.location.href='{frontend}/dashboard';}}, 1500);</script></body></html>", media_type="text/html")

@api_router.post("/google/oauth/disconnect")
async def google_oauth_disconnect(user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"google_refresh_token": "", "google_connected_at": ""}})
    return {"ok": True}

@api_router.get("/google/status")
async def google_status(user=Depends(get_current_user)):
    return {"connected": bool(user.get("google_refresh_token")), "connected_at": user.get("google_connected_at")}

@api_router.get("/google/calendar/free-slots")
async def google_free_slots(user=Depends(get_current_user)):
    if not user.get("google_refresh_token"):
        return {"connected": False, "slots": []}
    creds = GoogleCreds(token=None, refresh_token=user["google_refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET, scopes=GOOGLE_SCOPES)
    try:
        def _read():
            service = gapi_build("calendar", "v3", credentials=creds, cache_discovery=False)
            now = datetime.now(timezone.utc)
            end = now + timedelta(days=7)
            busy = service.freebusy().query(body={
                "timeMin": now.isoformat().replace("+00:00","Z"),
                "timeMax": end.isoformat().replace("+00:00","Z"),
                "items": [{"id": "primary"}],
            }).execute()
            return busy
        result = await asyncio.to_thread(_read)
        return {"connected": True, "raw": result}
    except Exception as e:
        return {"connected": True, "error": str(e)[:120]}

# ============= ADMIN ANALYTICS =============
@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    total_clients = await db.users.count_documents({"role": "client"})
    active_clients = await db.users.count_documents({"role": "client", "active": True})
    total_bookings = await db.bookings.count_documents({})
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    bookings_week = await db.bookings.count_documents({"created_at": {"$gte": week_ago}})
    total_calls = await db.calls.count_documents({})
    live_calls = await db.calls.count_documents({"status": "live_call_placed"})
    total_files = await db.files.count_documents({"is_deleted": False})
    # Aggregate metrics
    agg = await db.metrics.aggregate([
        {"$group": {"_id": None,
            "chats": {"$sum": "$chats"},
            "escalations": {"$sum": "$escalations"},
            "voice_seconds": {"$sum": "$voice_seconds"},
            "videos": {"$sum": "$videos_generated"}}}
    ]).to_list(1)
    m = agg[0] if agg else {}
    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "total_bookings": total_bookings,
        "bookings_week": bookings_week,
        "total_chats": m.get("chats", 0),
        "total_escalations": m.get("escalations", 0),
        "voice_minutes": round(m.get("voice_seconds", 0) / 60, 1),
        "videos_generated": m.get("videos", 0),
        "total_calls": total_calls,
        "live_calls": live_calls,
        "total_files": total_files,
    }

@api_router.get("/admin/activity")
async def admin_activity(admin=Depends(require_admin)):
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    calls = await db.calls.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    # Enrich with tenant emails
    all_uids = list({b["tenant_id"] for b in bookings} | {c.get("tenant_id") for c in calls if c.get("tenant_id")})
    users = await db.users.find({"id": {"$in": all_uids}}, {"_id": 0, "id": 1, "email": 1, "full_name": 1}).to_list(200)
    umap = {u["id"]: u for u in users}
    for b in bookings:
        u = umap.get(b["tenant_id"], {})
        b["tenant_email"] = u.get("email", "unknown")
    for c in calls:
        u = umap.get(c.get("tenant_id"), {})
        c["tenant_email"] = u.get("email", "unknown")
    return {"bookings": bookings, "calls": calls}

@api_router.get("/admin/health")
async def admin_health(admin=Depends(require_admin)):
    return {
        "emergent_llm": bool(EMERGENT_LLM_KEY),
        "resend": bool(RESEND_API_KEY),
        "ses": bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and SES_FROM_EMAIL),
        "twilio_configured": bool(TWILIO_SID and (TWILIO_TOKEN or (TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET))),
        "twilio_can_call": bool(TWILIO_SID and (TWILIO_TOKEN or (TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET)) and TWILIO_FROM),
        "twilio_from": TWILIO_FROM or None,
        "telnyx_configured": bool(TELNYX_API_KEY),
        "telnyx_can_call": bool(TELNYX_API_KEY and TELNYX_PHONE_NUMBER),
        "telnyx_phone": TELNYX_PHONE_NUMBER or None,
        "google_oauth": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "escalation_target": ESCALATION_TARGET or None,
        "fal_configured": bool(FAL_KEY),
        "object_storage": bool(storage_key),
    }

@api_router.get("/admin/users/{user_id}/metrics")
async def admin_user_metrics(user_id: str, admin=Depends(require_admin)):
    m = await db.metrics.find_one({"tenant_id": user_id}, {"_id": 0}) or {}
    bookings = await db.bookings.count_documents({"tenant_id": user_id})
    escalations_calls = await db.calls.count_documents({"tenant_id": user_id})
    return {
        "chats": m.get("chats", 0),
        "escalations": m.get("escalations", 0),
        "voice_seconds": m.get("voice_seconds", 0),
        "videos": m.get("videos_generated", 0),
        "bookings": bookings,
        "calls": escalations_calls,
    }

# ============= AVATAR / LIPSYNC (fal.ai veed/lipsync) =============
# In-memory temp store for audio to serve to fal.ai
_temp_audio = {}

@api_router.get("/public/audio/{aid}.mp3")
async def public_audio(aid: str):
    data = _temp_audio.get(aid)
    if not data:
        raise HTTPException(404, "Audio expired")
    return Response(content=data, media_type="audio/mpeg")

@api_router.get("/public/avatar/{gender}.jpg")
async def public_avatar(gender: str):
    entry = _avatar_cache.get(gender)
    if entry:
        mime, data = entry
        return Response(content=data, media_type=mime, headers={"Cache-Control": "public, max-age=86400"})
    raise HTTPException(404, "Avatar not available")

@api_router.get("/avatar/profiles")
async def avatar_profiles():
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL") or "https://env-recovery-build.preview.emergentagent.com"
    return {k: {"image": f"{frontend_url}/api/public/avatar/{k}.jpg", "voice": v["voice"], "label": v["label"]} for k, v in AVATAR_PROFILES.items()}

class LipsyncReq(BaseModel):
    tenant_id: str
    text: str

def _run_fal_lipsync(video_url: str, audio_url: str) -> str:
    """Blocking fal-client call. Returns generated video URL."""
    result = fal_client.subscribe(
        "veed/lipsync",
        arguments={"video_url": video_url, "audio_url": audio_url},
        with_logs=False,
    )
    # veed/lipsync returns {'video': {'url': '...'}}
    if isinstance(result, dict):
        vid = result.get("video") or {}
        return vid.get("url") if isinstance(vid, dict) else vid
    return None

@api_router.post("/avatar/lipsync")
async def avatar_lipsync(req: LipsyncReq):
    if not FAL_KEY:
        raise HTTPException(400, "FAL_KEY not configured")
    tenant = await db.users.find_one({"id": req.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    gender = tenant.get("avatar_gender", "female")
    profile = AVATAR_PROFILES.get(gender, AVATAR_PROFILES["female"])
    # 1) Generate TTS audio bytes
    tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    try:
        b64 = await tts.generate_speech_base64(text=req.text[:800], voice=profile["voice"], model="tts-1-hd", response_format="mp3")
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {e}")
    audio_bytes = base64.b64decode(b64)
    aid = str(uuid.uuid4())
    _temp_audio[aid] = audio_bytes
    # Clean up old audio (keep last 20)
    if len(_temp_audio) > 20:
        for old_key in list(_temp_audio.keys())[:-20]:
            _temp_audio.pop(old_key, None)
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL") or "https://env-recovery-build.preview.emergentagent.com"
    audio_url = f"{frontend_url}/api/public/audio/{aid}.mp3"
    # 2) Submit to fal
    try:
        video_url = await asyncio.to_thread(_run_fal_lipsync, profile["video"], audio_url)
        if not video_url:
            raise HTTPException(500, "fal.ai returned empty video URL")
        # metrics
        secs = max(1, int(len(req.text) / 15))
        await db.metrics.update_one({"tenant_id": req.tenant_id}, {"$inc": {"voice_seconds": secs, "videos_generated": 1}}, upsert=True)
        return {"ok": True, "video_url": video_url, "audio_b64": b64, "gender": gender, "voice": profile["voice"]}
    except Exception as e:
        logger.error(f"fal lipsync failed: {e}")
        # graceful fallback: return audio only + image
        return {"ok": False, "error": str(e)[:120], "video_url": None, "audio_b64": b64, "gender": gender, "voice": profile["voice"]}

# ============= METRICS =============
@api_router.get("/me/metrics")
async def me_metrics(user=Depends(get_current_user)):
    tid = user["id"]
    m = await db.metrics.find_one({"tenant_id": tid}, {"_id": 0}) or {}
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    bookings_week = await db.bookings.count_documents({"tenant_id": tid, "created_at": {"$gte": week_ago.isoformat()}})
    chats_total = m.get("chats", 0)
    escalations = m.get("escalations", 0)
    voice_secs = m.get("voice_seconds", 0)
    voice_min = round(voice_secs / 60, 1)
    conv_rate = 0.0
    if chats_total > 0:
        conv_rate = round(((bookings_week + escalations) / chats_total) * 100, 1)
    # Populate realistic demo numbers when the workspace has no real traffic yet,
    # so the dashboard feels alive instead of showing all zeros.
    if chats_total == 0 and bookings_week == 0 and voice_secs == 0:
        return {
            "chats_today": 47,
            "bookings_week": 12,
            "voice_minutes": 38.5,
            "conversion_rate": 25.5,
            "is_sample": True,
        }
    return {
        "chats_today": chats_total,
        "bookings_week": bookings_week,
        "voice_minutes": voice_min,
        "conversion_rate": conv_rate,
        "is_sample": False,
    }

@api_router.get("/me/activity")
async def me_activity(user=Depends(get_current_user)):
    """Recent activity feed. Returns real events (bookings, chats, escalations) and
    falls back to lively simulated events when the workspace is brand new."""
    tid = user["id"]
    events = []
    bookings = await db.bookings.find({"tenant_id": tid}, {"_id": 0}).sort("created_at", -1).limit(6).to_list(6)
    for b in bookings:
        events.append({"type": "booking", "text": f"New booking · {b.get('customer_email','a visitor')}", "at": b.get("created_at")})
    convs = await db.conversations.find({"tenant_id": tid}, {"_id": 0}).sort("last_at", -1).limit(6).to_list(6)
    for c in convs:
        events.append({"type": "chat", "text": f"Chat · {(c.get('last_message') or 'New conversation')[:48]}", "at": c.get("last_at")})
    calls = await db.calls.find({"tenant_id": tid}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
    for c in calls:
        events.append({"type": "escalation", "text": "Human escalation requested", "at": c.get("created_at")})
    events = [e for e in events if e.get("at")]
    events.sort(key=lambda e: e["at"], reverse=True)
    if events:
        return {"events": events[:8], "is_sample": False}
    # Simulated feed so a fresh workspace still feels alive
    now = datetime.now(timezone.utc)
    sample = [
        {"type": "chat", "text": "Chat · \"Do you ship to Canada?\"", "mins": 3},
        {"type": "booking", "text": "New booking · demo.customer@gmail.com", "mins": 24},
        {"type": "chat", "text": "Chat · \"What's your return policy?\"", "mins": 51},
        {"type": "escalation", "text": "Human escalation requested", "mins": 96},
        {"type": "chat", "text": "Photo product search · sneakers", "mins": 133},
        {"type": "booking", "text": "New booking · alex.p@outlook.com", "mins": 189},
    ]
    return {"events": [{"type": s["type"], "text": s["text"], "at": (now - timedelta(minutes=s["mins"])).isoformat()} for s in sample], "is_sample": True}

# ============= MESSAGES INBOX =============
@api_router.get("/messages/conversations")
async def list_conversations(user=Depends(get_current_user)):
    """List all conversations for this tenant, most recent first."""
    convs = await db.conversations.find(
        {"tenant_id": user["id"]}, {"_id": 0}
    ).sort("last_at", -1).limit(200).to_list(200)
    return convs

@api_router.get("/messages/conversations/{session_id}")
async def get_conversation(session_id: str, user=Depends(get_current_user)):
    """Return all messages in a conversation for this tenant."""
    conv = await db.conversations.find_one({"session_id": session_id, "tenant_id": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    msgs = await db.messages.find(
        {"session_id": session_id, "tenant_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return {"conversation": conv, "messages": msgs}

class MessageReply(BaseModel):
    text: str

@api_router.post("/messages/conversations/{session_id}/reply")
async def human_reply(session_id: str, req: MessageReply, user=Depends(get_current_user)):
    """Business owner takes over the chat and posts a human reply.
    Marks the conversation as human-handled so future visitor messages aren't
    auto-answered by the AI (front-end respects the 'status' field)."""
    conv = await db.conversations.find_one({"session_id": session_id, "tenant_id": user["id"]})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    _now = now_iso()
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "session_id": session_id, "tenant_id": user["id"],
        "role": "human_agent", "text": req.text, "created_at": _now,
    })
    await db.conversations.update_one(
        {"session_id": session_id, "tenant_id": user["id"]},
        {"$set": {"status": "human", "last_reply": req.text[:200], "last_at": _now, "human_active": True}, "$inc": {"msg_count": 1}},
    )
    return {"ok": True}

@api_router.post("/messages/conversations/{session_id}/mark")
async def mark_conversation(session_id: str, status: str = Query(...), user=Depends(get_current_user)):
    """Mark a conversation as read/closed/ai/human."""
    if status not in ("read", "closed", "ai", "human", "open"):
        raise HTTPException(400, "Invalid status")
    await db.conversations.update_one(
        {"session_id": session_id, "tenant_id": user["id"]},
        {"$set": {"status": status}},
    )
    return {"ok": True}

@api_router.get("/chat/session/{session_id}/pending")
async def visitor_poll_pending(session_id: str, tenant_id: str = Query(...), since: Optional[str] = Query(None)):
    """VISITOR-facing poll for human_agent messages.
    The widget calls this every few seconds while open — returns any human_agent
    (business-owner) replies newer than `since`. No auth (the session_id is the
    secret; only that visitor knows it)."""
    q = {"session_id": session_id, "tenant_id": tenant_id, "role": "human_agent"}
    if since:
        q["created_at"] = {"$gt": since}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).limit(50).to_list(50)
    return {"messages": msgs, "server_time": now_iso()}

# ============= ORDER TRACKING (Shopify) =============
class OrderTrackRequest(BaseModel):
    tenant_id: str
    order_number: str
    email: Optional[str] = None

def _shopify_stages(order: dict) -> List[dict]:
    """Convert a Shopify order dict into a normalised 4-stage timeline."""
    financial = (order.get("financial_status") or "").lower()  # paid / pending / refunded
    fulfillment = (order.get("fulfillment_status") or "").lower()  # fulfilled / partial / null
    created_at = order.get("created_at")
    fulfillments = order.get("fulfillments") or []
    shipped_at = None
    delivered_at = None
    tracking_number = None
    tracking_url = None
    for f in fulfillments:
        if f.get("created_at") and not shipped_at:
            shipped_at = f.get("created_at")
        if (f.get("shipment_status") or "").lower() == "delivered":
            delivered_at = f.get("updated_at") or f.get("created_at")
        tn = f.get("tracking_number") or (f.get("tracking_numbers") or [None])[0]
        tu = f.get("tracking_url") or (f.get("tracking_urls") or [None])[0]
        if tn and not tracking_number: tracking_number = tn
        if tu and not tracking_url: tracking_url = tu
    ordered_done = bool(created_at)
    packed_done = fulfillment in ("fulfilled", "partial") or bool(shipped_at)
    shipped_done = bool(shipped_at) or fulfillment == "fulfilled"
    delivered_done = bool(delivered_at)
    return [
        {"key": "ordered", "label": "Ordered", "done": ordered_done, "at": created_at},
        {"key": "packed", "label": "Packed", "done": packed_done, "at": shipped_at if packed_done else None},
        {"key": "shipped", "label": "Shipped", "done": shipped_done, "at": shipped_at},
        {"key": "delivered", "label": "Delivered", "done": delivered_done, "at": delivered_at},
    ], tracking_number, tracking_url

@api_router.post("/order/track")
async def track_order(req: OrderTrackRequest):
    """Look up a Shopify order and return a normalised 4-stage timeline the
    widget can render as a package journey. Requires the tenant to have set
    `shopify_domain` and `shopify_admin_token` under Settings → Integrations."""
    tenant = await db.users.find_one({"id": req.tenant_id})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    domain = (tenant.get("shopify_domain") or "").replace("https://", "").replace("http://", "").rstrip("/")
    token = tenant.get("shopify_admin_token")
    if not domain or not token:
        raise HTTPException(400, "This store hasn't connected Shopify order tracking yet. Ask the owner to configure it under Settings → Integrations.")
    # Normalise order number ("#1042" -> "1042")
    num = req.order_number.strip().lstrip("#")
    url = f"https://{domain}/admin/api/2024-04/orders.json?name={num}&status=any"
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"})
            r.raise_for_status()
            orders = r.json().get("orders", [])
    except Exception as e:
        logger.error(f"Shopify lookup failed: {e}")
        raise HTTPException(502, "Couldn't reach Shopify — please double-check the order number in a moment.")
    if req.email:
        orders = [o for o in orders if (o.get("email") or "").lower() == req.email.lower()] or orders
    if not orders:
        raise HTTPException(404, f"No order matching #{num} was found. Please check the number and try again.")
    order = orders[0]
    stages, tracking_number, tracking_url = _shopify_stages(order)
    return {
        "order_number": order.get("name") or f"#{num}",
        "financial_status": order.get("financial_status"),
        "fulfillment_status": order.get("fulfillment_status"),
        "total": order.get("total_price"),
        "currency": order.get("currency"),
        "stages": stages,
        "tracking_number": tracking_number,
        "tracking_url": tracking_url,
    }

# ============= PHOTO PRODUCT SEARCH (GPT-4o vision) =============
@api_router.post("/vision/product-search")
async def vision_product_search(tenant_id: str = Query(...), file: UploadFile = File(...)):
    """Visitor uploads a photo of a product; we ask GPT-4o vision to describe
    it and match against the tenant's catalog. Returns up to 3 matches."""
    from emergentintegrations.llm.chat import FileContent
    tenant = await db.users.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    catalog = tenant.get("catalog") or []
    if not catalog:
        raise HTTPException(400, "This store hasn't synced their product catalog yet — photo search is unavailable.")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Please upload an image (PNG, JPG, or WEBP).")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image too large — max 8MB.")
    b64 = base64.b64encode(data).decode()
    # Truncate the catalog string to avoid token blowup
    cat_lines = []
    for i, p in enumerate(catalog[:60]):
        cat_lines.append(f"{i}. {p.get('name','')} — {p.get('price','')} — {p.get('description','')[:120]}")
    catalog_text = "\n".join(cat_lines)
    system = (
        "You are a product-matching assistant. The visitor sent a photo of an item "
        "they want to find in this store. Compare the image to the catalog below and "
        "return the 3 best matches. Respond with STRICT JSON only, no markdown, in the form: "
        '{"description":"<what you see in the photo, 1 sentence>","matches":[{"index":<int>,"reason":"<short>"}]}'
    )
    user_prompt = f"Catalog (index. name — price — description):\n{catalog_text}\n\nMatch the attached photo to up to 3 items. If nothing fits, return an empty matches array."
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"vision-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-4o")
        # emergentintegrations expects content_type="image" (literal); it will
        # auto-detect the MIME from the base64 header.
        msg = UserMessage(text=user_prompt, file_contents=[FileContent(content_type="image", file_content_base64=b64)])
        reply = await chat.send_message(msg)
        text = reply if isinstance(reply, str) else getattr(reply, "text", str(reply))
    except Exception as e:
        logger.error(f"Vision search failed: {e}")
        raise HTTPException(502, "Sorry, image analysis is unavailable right now. Please describe what you're looking for.")
    # Parse JSON out of the reply (LLM sometimes wraps in ```json)
    import re as _re
    m = _re.search(r"\{.*\}", text, _re.DOTALL)
    parsed = {"description": "", "matches": []}
    if m:
        try:
            parsed = json.loads(m.group(0))
        except Exception:
            pass
    hydrated = []
    for match in (parsed.get("matches") or [])[:3]:
        idx = match.get("index")
        if isinstance(idx, int) and 0 <= idx < len(catalog):
            p = catalog[idx]
            hydrated.append({
                "name": p.get("name"),
                "price": p.get("price"),
                "url": p.get("url"),
                "image": p.get("image"),
                "reason": match.get("reason", ""),
            })
    return {"description": parsed.get("description", ""), "matches": hydrated}


# ============= VOICE (Whisper STT + OpenAI TTS) =============
@api_router.post("/voice/stt")
async def voice_stt(file: UploadFile = File(...)):
    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    # Save temp then pass file handle
    data = await file.read()
    tmp = Path(f"/tmp/{uuid.uuid4()}_{file.filename or 'audio.webm'}")
    tmp.write_bytes(data)
    try:
        with open(tmp, "rb") as f:
            resp = await stt.transcribe(file=f, model="whisper-1", response_format="json")
        text = getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else str(resp))
        return {"text": text}
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(500, f"Transcription failed: {e}")
    finally:
        try: tmp.unlink()
        except Exception: pass

class TTSReq(BaseModel):
    text: str
    voice: str = "nova"
    tenant_id: Optional[str] = None

@api_router.post("/voice/tts")
async def voice_tts(req: TTSReq):
    tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    try:
        b64 = await tts.generate_speech_base64(text=req.text[:2000], voice=req.voice, model="tts-1-hd", response_format="mp3")
        if req.tenant_id:
            # ~ 150 words/min TTS; approximate seconds from char count
            secs = max(1, int(len(req.text) / 15))
            await db.metrics.update_one({"tenant_id": req.tenant_id}, {"$inc": {"voice_seconds": secs}}, upsert=True)
        return {"audio_base64": b64, "mime": "audio/mpeg"}
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(500, f"TTS failed: {e}")

# ============= EMBED LOADER SCRIPT =============
@api_router.get("/embed/{tenant_id}/loader.js")
async def embed_loader(tenant_id: str):
    tenant = await db.users.find_one({"id": tenant_id, "active": True}, {"_id": 0})
    if not tenant:
        return Response(content="console.warn('[Rozio-Killer] widget disabled - account inactive or missing');", media_type="application/javascript")
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/") or "https://env-recovery-build.preview.emergentagent.com"
    bg = tenant.get("widget_bg", "#1A202C")
    bubble = tenant.get("bubble_color", "#48BB78")
    accent = tenant.get("accent_color", "#48BB78")
    bot_name = (tenant.get("bot_name") or tenant.get("full_name") or "AI Concierge").replace('"', '\\"')
    js = f"""
(function(){{
  if(window.__RozioKillerLoaded) return; window.__RozioKillerLoaded=true;
  var TENANT="{tenant_id}", ORIGIN="{frontend_url}";
  var BG="{bg}", BUBBLE="{bubble}", ACCENT="{accent}", NAME="{bot_name}";
  var IS_MOBILE = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;

  // Inject minimal keyframes so the launcher pulses subtly
  var st = document.createElement('style');
  st.textContent = '@keyframes rk-pulse{{0%,100%{{box-shadow:0 8px 32px rgba(0,0,0,.35),0 0 0 0 '+ACCENT+'66}}50%{{box-shadow:0 8px 32px rgba(0,0,0,.35),0 0 0 14px '+ACCENT+'00}}}}@keyframes rk-fade-up{{from{{opacity:0;transform:translateY(12px)}}to{{opacity:1;transform:translateY(0)}}}}';
  document.head.appendChild(st);

  // Wrapper container so we can add the launcher + optional teaser bubble
  var wrap = document.createElement('div');
  wrap.setAttribute('id', 'rk-widget-root');
  wrap.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
  document.body.appendChild(wrap);

  // Launcher button
  var launcher=document.createElement('button');
  launcher.setAttribute('data-testid','rk-embed-launcher');
  launcher.setAttribute('aria-label','Open chat');
  launcher.style.cssText="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,"+ACCENT+","+ACCENT+"cc);color:#0D1117;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s ease;animation:rk-pulse 2.4s ease-in-out infinite";
  launcher.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  launcher.onmouseenter = function(){{ launcher.style.transform='scale(1.06)'; }};
  launcher.onmouseleave = function(){{ launcher.style.transform='scale(1)'; }};
  wrap.appendChild(launcher);

  // Teaser message that appears after 2s
  var teaser = document.createElement('div');
  teaser.style.cssText = 'position:absolute;bottom:72px;right:0;background:#fff;color:#111;padding:10px 14px;border-radius:14px;border-bottom-right-radius:4px;box-shadow:0 12px 32px rgba(0,0,0,.18);font-size:13px;font-weight:500;max-width:230px;line-height:1.35;opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;cursor:pointer;';
  teaser.textContent = '&#128075; Hi! Ask me anything about ' + NAME.split(' ')[0];
  teaser.innerHTML = '&#128075; Hi! I can help &mdash; ask me anything.';
  teaser.onclick = function(){{ launcher.click(); }};
  wrap.appendChild(teaser);
  setTimeout(function(){{ if(!frame){{ teaser.style.opacity='1'; teaser.style.transform='translateY(0)'; }} }}, 1800);
  setTimeout(function(){{ teaser.style.opacity='0'; teaser.style.transform='translateY(6px)'; setTimeout(function(){{try{{teaser.remove();}}catch(e){{}}}}, 400); }}, 12000);

  var frame=null;
  launcher.onclick=function(){{
    if(frame){{frame.remove();frame=null;launcher.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';return;}}
    try{{ teaser.remove(); }}catch(e){{}}
    frame=document.createElement('iframe');
    frame.setAttribute('title','AI Concierge Chat');
    frame.setAttribute('allow','microphone; autoplay; clipboard-write');
    frame.src=ORIGIN+'/embed-widget?tenant='+TENANT;
    if (IS_MOBILE) {{
      frame.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;border:none;z-index:2147483647;background:"+BG;
    }} else {{
      frame.style.cssText="position:fixed;bottom:96px;right:20px;width:400px;height:640px;max-height:calc(100vh - 120px);border:none;border-radius:20px;box-shadow:0 24px 72px rgba(0,0,0,.5);z-index:2147483647;background:"+BG+";animation:rk-fade-up .28s cubic-bezier(.2,.9,.3,1)";
    }}
    document.body.appendChild(frame);
    launcher.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  }};

  // Listen for close message from iframe
  window.addEventListener('message', function(e){{
    if (e && e.data && e.data.type === 'rk:close' && frame) {{ frame.remove(); frame=null; launcher.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }}
  }});
}})();
"""
    return Response(content=js, media_type="application/javascript", headers={"Cache-Control": "public, max-age=60"})

# ============= INTEGRATIONS HUB (encrypted secrets) =============
INTEGRATION_PROVIDERS = {
    "zoom": {"label": "Zoom", "fields": ["api_key", "api_secret"], "type": "api_key"},
    "calendly": {"label": "Calendly", "fields": ["api_key"], "type": "api_key"},
    "slack": {"label": "Slack", "fields": ["webhook_url"], "type": "api_key"},
    "stripe": {"label": "Stripe", "fields": ["api_key"], "type": "api_key"},
    "hubspot": {"label": "HubSpot", "fields": ["api_key"], "type": "api_key"},
}

class IntegrationSaveReq(BaseModel):
    provider: str
    values: dict

@api_router.get("/me/integrations")
async def list_integrations(user=Depends(get_current_user)):
    """Return configured integrations for this client with secrets MASKED (never plaintext)."""
    docs = await db.integrations.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    by_provider = {d["provider"]: d for d in docs}
    out = []
    for key, spec in INTEGRATION_PROVIDERS.items():
        d = by_provider.get(key)
        connected = bool(d and d.get("values"))
        masked = {}
        if d:
            for f, enc in (d.get("values") or {}).items():
                masked[f] = mask_secret(decrypt_secret(enc))
        out.append({
            "provider": key,
            "label": spec["label"],
            "fields": spec["fields"],
            "connected": connected,
            "masked": masked,
            "updated_at": d.get("updated_at") if d else None,
        })
    return {"integrations": out}

@api_router.put("/me/integrations")
async def save_integration(req: IntegrationSaveReq, user=Depends(get_current_user)):
    spec = INTEGRATION_PROVIDERS.get(req.provider)
    if not spec:
        raise HTTPException(400, "Unknown integration provider")
    enc_values = {}
    for f in spec["fields"]:
        val = (req.values or {}).get(f, "")
        if val:
            enc_values[f] = encrypt_secret(val)
    await db.integrations.update_one(
        {"user_id": user["id"], "provider": req.provider},
        {"$set": {"user_id": user["id"], "provider": req.provider, "values": enc_values, "updated_at": now_iso()}},
        upsert=True,
    )
    await log_audit(user, "integration.save", req.provider, {"fields": list(enc_values.keys())})
    return {"ok": True}

@api_router.delete("/me/integrations/{provider}")
async def delete_integration(provider: str, user=Depends(get_current_user)):
    await db.integrations.delete_one({"user_id": user["id"], "provider": provider})
    await log_audit(user, "integration.delete", provider)
    return {"ok": True}

# ============= RBAC / IMPERSONATION (View As) =============
@api_router.post("/admin/impersonate/{user_id}")
async def admin_impersonate(user_id: str, admin=Depends(require_admin)):
    """Mint a short-lived token scoped to a client so the admin can troubleshoot
    their dashboard without their credentials. The token carries impersonated_by."""
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Client not found")
    token = make_token(target["id"], target.get("role", "client"), impersonated_by=admin["id"])
    await log_audit(admin, "impersonate.start", target.get("email"), {"target_id": user_id})
    return {"token": token, "user": {"id": target["id"], "email": target["email"], "role": target.get("role", "client"), "full_name": target.get("full_name")}}

# ============= AUDIT LOG =============
@api_router.get("/admin/audit")
async def admin_audit(q: str = Query("", description="search term"), admin=Depends(require_admin)):
    query = {}
    if q:
        query = {"$or": [
            {"actor_email": {"$regex": q, "$options": "i"}},
            {"action": {"$regex": q, "$options": "i"}},
            {"target": {"$regex": q, "$options": "i"}},
        ]}
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"logs": logs}

# ============= CONVERSATION TRAINING CENTER =============
class TrainingCorrectionReq(BaseModel):
    session_id: Optional[str] = None
    message_id: Optional[str] = None
    question: str = ""
    original: str = ""
    corrected: str

@api_router.get("/me/training/transcripts")
async def training_transcripts(user=Depends(get_current_user)):
    """Return recent assistant replies (with the preceding visitor question) so the
    client can review and correct how the AI answered."""
    tid = user["id"]
    msgs = await db.messages.find({"tenant_id": tid}, {"_id": 0}).sort("created_at", -1).limit(80).to_list(80)
    msgs.reverse()
    pairs = []
    last_user = None
    for m in msgs:
        if m.get("role") == "user":
            last_user = m
        elif m.get("role") == "assistant":
            pairs.append({
                "message_id": m.get("id"),
                "session_id": m.get("session_id"),
                "question": (last_user or {}).get("text", ""),
                "answer": m.get("text", ""),
                "created_at": m.get("created_at"),
            })
    pairs.reverse()
    return {"transcripts": pairs[:40]}

@api_router.get("/me/training/corrections")
async def training_corrections_list(user=Depends(get_current_user)):
    docs = await db.training_corrections.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"corrections": docs}

@api_router.post("/me/training/correct")
async def training_correct(req: TrainingCorrectionReq, user=Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": req.session_id,
        "message_id": req.message_id,
        "question": req.question,
        "original": req.original,
        "corrected": req.corrected,
        "created_at": now_iso(),
    }
    await db.training_corrections.insert_one(doc.copy())
    await log_audit(user, "training.correct", req.message_id or "", {"question": req.question[:80]})
    return {"ok": True, "correction": doc}

@api_router.delete("/me/training/corrections/{correction_id}")
async def training_correction_delete(correction_id: str, user=Depends(get_current_user)):
    await db.training_corrections.delete_one({"id": correction_id, "user_id": user["id"]})
    return {"ok": True}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
