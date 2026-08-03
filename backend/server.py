from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import StreamingResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, uuid, logging, asyncio, jwt, bcrypt, requests, resend, json, secrets, string

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech
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
APP_NAME = "rozio-killer"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER", "")
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

def make_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

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

# ============= MODELS =============
class RegisterReq(BaseModel):
    full_name: str
    email: EmailStr
    target_domain: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

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

class ChatReq(BaseModel):
    session_id: str
    message: str
    user_id: Optional[str] = None  # tenant id for sandbox

class BookingReq(BaseModel):
    slot: str
    customer_email: EmailStr
    tenant_id: str

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
        if image_bytes:
            _avatar_cache[g] = ("image/jpeg", image_bytes)
        else:
            # Fallback: dicebear SVG (stable, clearly AI-generated)
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

@api_router.post("/auth/register")
async def register(req: RegisterReq):
    s = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not (s and s.get("public_signup_enabled", True)):
        raise HTTPException(403, "Public signup is disabled. Contact admin for access.")
    if await db.users.find_one({"email": req.email}):
        raise HTTPException(400, "Email already registered")
    pw = gen_password()
    user = {
        "id": str(uuid.uuid4()),
        "email": req.email,
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
    from urllib.parse import urljoin
    for img in soup.find_all("img")[:40]:
        src = img.get("src") or img.get("data-src")
        if not src: continue
        if src.startswith("//"): src = "https:" + src
        elif src.startswith("/"): src = urljoin(url, src)
        if src.startswith("http") and src not in imgs and any(ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
            imgs.append(src)
        if len(imgs) >= 10: break
    system = (
        "You are a web-page extractor. Given HTML text content from a business website, extract 3-6 top items "
        "(products for e-commerce, services for local business, or key offerings for general sites). "
        "Return STRICTLY valid JSON only, no prose, no markdown fences, in this exact format: "
        '{"kind":"product|service|offering","items":[{"name":"...","price":"$X or Contact","description":"one line"}], "delivery":{"US":"...","EU":"...","APAC":"..."}}'
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"crawl-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.6-terra")
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
        f"You are a friendly multi-lingual AI concierge for a {industry} business. "
        f"Business context: {instruction or 'No custom context.'} "
        f"IMPORTANT: Auto-detect the user's language and ALWAYS reply in that same language. "
        f"Be concise (2-4 sentences). "
        f"\n\nSPECIAL ACTIONS - VERY IMPORTANT: "
        f"When the user asks to speak with a human, agent, representative, or wants escalation of any kind, "
        f"first give a short friendly acknowledgement (1 sentence), then emit EXACTLY this marker on its own line: [[ACTION:escalate]] "
        f"When the user asks to book/schedule/reserve an appointment or slot, first ask which day/time works (or confirm one they proposed), "
        f"then emit EXACTLY this marker on its own line with the slot: [[ACTION:book:<slot description>]] "
        f"Only emit action markers when the user explicitly requests these; never volunteer them. "
    )
    if industry == "E-Commerce" and catalog:
        prod_str = "; ".join([f"{p['name']} ({p['price']})" for p in catalog])
        system += f" Available products: {prod_str}. "
        system += f" Delivery windows: {json.dumps(delivery)}. When asked about location or delivery, use these times. "
    system += " If asked to book an appointment, use the [[ACTION:book:<slot>]] marker (see rules above)."

    # RAG: inject PDF knowledge context
    if tenant_id:
        pdf_files = await db.files.find({"user_id": tenant_id, "is_deleted": False}, {"_id": 0, "content": 1, "original_filename": 1}).to_list(5)
        pdf_chunks = []
        for f in pdf_files:
            if f.get("content"):
                pdf_chunks.append(f"[Source: {f.get('original_filename', 'pdf')}]\n{f['content'][:6000]}")
        if pdf_chunks:
            system += "\n\n=== INTERNAL KNOWLEDGE BASE (cite when relevant) ===\n" + "\n\n---\n\n".join(pdf_chunks)

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=req.session_id, system_message=system).with_model("openai", "gpt-5.6-terra")

    # increment chats counter
    if tenant_id:
        await db.metrics.update_one({"tenant_id": tenant_id}, {"$inc": {"chats": 1}}, upsert=True)

    async def gen():
        try:
            async for ev in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            logger.error(f"Chat error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

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
    elif TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM and business_phone:
        try:
            tw = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
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
    # Build a Google Calendar "add event" URL. Try to parse simple time cues (today, tomorrow, HH:MM am/pm) from the slot text; otherwise default to +1 day 15:00 UTC.
    from datetime import datetime as _dt
    import re as _re
    slot_lower = (req.slot or "").lower()
    start_utc = _dt.now(timezone.utc) + timedelta(days=1)
    if "today" in slot_lower:
        start_utc = _dt.now(timezone.utc)
    elif "next week" in slot_lower:
        start_utc = _dt.now(timezone.utc) + timedelta(days=7)
    # Look for HH(:MM)? (am|pm)?
    hm = _re.search(r"(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?", slot_lower)
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
    start_utc = start_utc.replace(hour=hour, minute=minute, second=0, microsecond=0)
    end_utc = start_utc + timedelta(minutes=30)
    fmt = "%Y%m%dT%H%M%SZ"
    dates = f"{start_utc.strftime(fmt)}/{end_utc.strftime(fmt)}"
    title = f"Appointment with {tenant.get('full_name', 'Business')}"
    details = f"Slot requested: {req.slot}. Booked via Rozio-Killer AI concierge."
    location = tenant.get("target_domain", "")
    gcal_url = (
        "https://www.google.com/calendar/render?action=TEMPLATE"
        f"&text={urlquote(title)}"
        f"&dates={dates}"
        f"&details={urlquote(details)}"
        f"&location={urlquote(location)}"
        f"&add={urlquote(req.customer_email)}"
    )
    booking = {"id": str(uuid.uuid4()), "tenant_id": req.tenant_id, "slot": req.slot, "customer_email": req.customer_email, "google_calendar_url": gcal_url, "created_at": now_iso()}
    await db.bookings.insert_one(booking.copy())
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Appointment Confirmed</h2>
    <p>Your booking with <b>{tenant.get('full_name', 'the business')}</b> is confirmed.</p>
    <p><b>Slot:</b> {req.slot}</p>
    <p><a href='{gcal_url}' style='display:inline-block;background:#48BB78;color:#1A202C;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold'>Add to Google Calendar</a></p>
    </div>
    """
    await send_email(req.customer_email, "Appointment Confirmed", html)
    await send_email(tenant["email"], "New Booking Received", html)
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
                    "description": details,
                    "start": {"dateTime": start_utc.isoformat().replace("+00:00", "Z")},
                    "end": {"dateTime": end_utc.isoformat().replace("+00:00", "Z")},
                    "attendees": [{"email": req.customer_email}],
                }
                return service.events().insert(calendarId="primary", body=event, sendUpdates="all").execute()
            ev = await asyncio.to_thread(_create_event)
            gcal_event_id = ev.get("id")
        except Exception as e:
            logger.error(f"Google Calendar create failed: {e}")
    # SMS lead alert to business owner
    biz_phone = tenant.get("business_owner_phone") or TELNYX_BUSINESS_OWNER_PHONE
    if TELNYX_API_KEY and TELNYX_PHONE_NUMBER and biz_phone:
        await send_sms(biz_phone, f"New booking: {req.slot} - {req.customer_email}. Rozio-Killer.")
    return {"ok": True, "booking": booking, "google_calendar_url": gcal_url, "google_event_id": gcal_event_id}

# ============= ADMIN =============
@api_router.put("/admin/settings")
async def admin_toggle(req: SettingsToggle, admin=Depends(require_admin)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        await db.settings.update_one({"id": "app_settings"}, {"$set": updates}, upsert=True)
    return {"ok": True}

@api_router.get("/admin/users")
async def admin_list(admin=Depends(require_admin)):
    users = await db.users.find({"role": "client"}, {"_id": 0, "password": 0}).to_list(500)
    return users

@api_router.post("/admin/users/create")
async def admin_create(req: AdminCreateReq, admin=Depends(require_admin)):
    if await db.users.find_one({"email": req.email}):
        raise HTTPException(400, "Email already exists")
    pw = gen_password()
    user = {
        "id": str(uuid.uuid4()),
        "email": req.email,
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
    return {"ok": True, "email": req.email, "temporary_password": pw}

@api_router.post("/admin/users/{user_id}/deactivate")
async def admin_deactivate(user_id: str, admin=Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    return {"ok": True}

@api_router.post("/admin/users/{user_id}/activate")
async def admin_activate(user_id: str, admin=Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"active": True}})
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
    return {"ok": True}

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
        "twilio_configured": bool(TWILIO_SID and TWILIO_TOKEN),
        "twilio_can_call": bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM),
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
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL") or "https://saas-ai-platform-5.preview.emergentagent.com"
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
        b64 = await tts.generate_speech_base64(text=req.text[:800], voice=profile["voice"], model="tts-1", response_format="mp3")
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {e}")
    audio_bytes = base64.b64decode(b64)
    aid = str(uuid.uuid4())
    _temp_audio[aid] = audio_bytes
    # Clean up old audio (keep last 20)
    if len(_temp_audio) > 20:
        for old_key in list(_temp_audio.keys())[:-20]:
            _temp_audio.pop(old_key, None)
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL") or "https://saas-ai-platform-5.preview.emergentagent.com"
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
        return {"ok": False, "error": str(e)[:120], "video_url": None, "audio_b64": b64, "gender": gender, "voice": profile["voice"], "fallback_image": profile["image"]}

# ============= METRICS =============
@api_router.get("/me/metrics")
async def me_metrics(user=Depends(get_current_user)):
    tid = user["id"]
    m = await db.metrics.find_one({"tenant_id": tid}, {"_id": 0}) or {}
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    bookings_week = await db.bookings.count_documents({"tenant_id": tid, "created_at": {"$gte": week_ago.isoformat()}})
    # rough "chats today" - since we don't timestamp per-chat, just show total chats
    chats_total = m.get("chats", 0)
    escalations = m.get("escalations", 0)
    voice_secs = m.get("voice_seconds", 0)
    voice_min = round(voice_secs / 60, 1)
    conv_rate = 0.0
    if chats_total > 0:
        conv_rate = round(((bookings_week + escalations) / chats_total) * 100, 1)
    return {
        "chats_today": chats_total,
        "bookings_week": bookings_week,
        "voice_minutes": voice_min,
        "conversion_rate": conv_rate,
    }

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
        b64 = await tts.generate_speech_base64(text=req.text[:2000], voice=req.voice, model="tts-1", response_format="mp3")
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
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/") or "https://saas-ai-platform-5.preview.emergentagent.com"
    bg = tenant.get("widget_bg", "#1A202C")
    bubble = tenant.get("bubble_color", "#48BB78")
    accent = tenant.get("accent_color", "#48BB78")
    js = f"""
(function(){{
  if(window.__RozioKillerLoaded) return; window.__RozioKillerLoaded=true;
  var TENANT="{tenant_id}", API="{frontend_url}/api";
  var BG="{bg}", BUBBLE="{bubble}", ACCENT="{accent}";
  var launcher=document.createElement('button');
  launcher.setAttribute('data-testid','rk-embed-launcher');
  launcher.style.cssText="position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:"+ACCENT+";color:"+BG+";border:none;box-shadow:0 8px 32px rgba(0,0,0,.35);cursor:pointer;font-family:sans-serif;font-weight:800;font-size:22px;z-index:2147483647";
  launcher.innerHTML='&#9679;';
  var frame=null;
  launcher.onclick=function(){{
    if(frame){{frame.remove();frame=null;launcher.innerHTML='&#9679;';return;}}
    frame=document.createElement('iframe');
    frame.src=API.replace('/api','')+'/embed-widget?tenant='+TENANT;
    frame.style.cssText="position:fixed;bottom:96px;right:24px;width:380px;height:600px;border:none;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:2147483647;background:"+BG;
    document.body.appendChild(frame);
    launcher.innerHTML='&times;';
  }};
  document.body.appendChild(launcher);
}})();
"""
    return Response(content=js, media_type="application/javascript")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
