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

def send_email_sync(to: str, subject: str, html: str):
    try:
        resend.Emails.send({"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html})
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False

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
    public_signup_enabled: bool

# ============= STARTUP =============
@app.on_event("startup")
async def startup():
    init_storage()
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
        await db.settings.insert_one({"id": "app_settings", "public_signup_enabled": True})
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
    return {"public_signup_enabled": s.get("public_signup_enabled", True) if s else True}

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
    url = payload.get("url", "")
    # Mock: return fake product catalog + delivery windows
    products = [
        {"name": "Aurora Runner X1", "price": "$189", "image": "https://images.unsplash.com/photo-1731132198530-e4b2dc51d511?w=400"},
        {"name": "NightHawk Trainer", "price": "$149", "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400"},
        {"name": "Vortex Pro Sneaker", "price": "$219", "image": "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400"},
    ]
    delivery = {"US": "2-4 business days", "EU": "5-7 business days", "APAC": "7-10 business days"}
    await db.users.update_one({"id": user["id"]}, {"$set": {"crawled_url": url, "catalog": products, "delivery": delivery}})
    return {"ok": True, "products": products, "delivery": delivery}

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
        f"You are a friendly multi-lingual AI assistant for a {industry} business. "
        f"Business context: {instruction or 'No custom context.'} "
        f"IMPORTANT: Auto-detect the user's language from their message and ALWAYS reply in that same language. "
        f"Be concise (2-4 sentences). "
    )
    if industry == "E-Commerce" and catalog:
        prod_str = "; ".join([f"{p['name']} ({p['price']})" for p in catalog])
        system += f" Available products: {prod_str}. "
        system += f" Delivery windows: {json.dumps(delivery)}. When asked about location or delivery, use these times. "
    system += " If asked to book an appointment, tell them to click a calendar slot."

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
    # Twilio real call if credentials + FROM number configured
    call_status = "mocked"
    call_sid = None
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM and ESCALATION_TARGET:
        try:
            twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
            call = twilio_client.calls.create(
                to=ESCALATION_TARGET,
                from_=TWILIO_FROM,
                twiml=f"<Response><Say voice='Polly.Joanna'>Live human escalation from Rozio Killer. A customer on {tenant.get('target_domain', 'your site')} is waiting. Transcript sent to your inbox.</Say></Response>",
            )
            call_sid = call.sid
            call_status = "live_call_placed"
        except Exception as e:
            logger.error(f"Twilio call failed: {e}")
            call_status = f"failed: {str(e)[:80]}"
    await db.calls.insert_one({"id": str(uuid.uuid4()), "tenant_id": req.tenant_id, "target": ESCALATION_TARGET, "status": call_status, "sid": call_sid, "created_at": now_iso()})
    await db.metrics.update_one({"tenant_id": req.tenant_id}, {"$inc": {"escalations": 1}}, upsert=True)
    return {"ok": True, "status": "Routing to Live Line...", "phone": ESCALATION_TARGET or "+1-555-ROZIO-AI", "call_status": call_status, "call_sid": call_sid}

@api_router.post("/booking/confirm")
async def booking_confirm(req: BookingReq):
    tenant = await db.users.find_one({"id": req.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    booking = {"id": str(uuid.uuid4()), "tenant_id": req.tenant_id, "slot": req.slot, "customer_email": req.customer_email, "created_at": now_iso()}
    await db.bookings.insert_one(booking.copy())
    html = f"""
    <div style='font-family:Arial;padding:24px;background:#1A202C;color:#fff'>
    <h2 style='color:#48BB78'>Appointment Confirmed</h2>
    <p>Your booking with <b>{tenant.get('full_name', 'the business')}</b> is confirmed.</p>
    <p><b>Slot:</b> {req.slot}</p>
    </div>
    """
    await send_email(req.customer_email, "Appointment Confirmed", html)
    await send_email(tenant["email"], "New Booking Received", html)
    return {"ok": True, "booking": booking}

# ============= ADMIN =============
@api_router.put("/admin/settings")
async def admin_toggle(req: SettingsToggle, admin=Depends(require_admin)):
    await db.settings.update_one({"id": "app_settings"}, {"$set": {"public_signup_enabled": req.public_signup_enabled}}, upsert=True)
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
