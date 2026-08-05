"""Backend tests for Rozio-Killer SaaS Phase 2 (voice/embed/RAG/twilio)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://env-recovery-build.preview.emergentagent.com').rstrip('/')
# Frontend .env holds public URL; use it explicitly here so test container talks via ingress
BASE_URL = "https://env-recovery-build.preview.emergentagent.com"

DEMO_EMAIL = "demo@client.com"
DEMO_PW = "Demo@12345"
ADMIN_EMAIL = "admin@rozio-killer.com"
ADMIN_PW = "Admin@12345"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PW})
    assert r.status_code == 200, f"demo login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_user_id(s, demo_token):
    r = s.get(f"{BASE_URL}/api/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    return r.json()["id"]


# ------------- Voice TTS -------------
def test_voice_tts_returns_audio(s):
    r = s.post(f"{BASE_URL}/api/voice/tts", json={"text": "Hello from Rozio Killer test."}, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("mime") == "audio/mpeg"
    assert isinstance(j.get("audio_base64"), str) and len(j["audio_base64"]) > 100


# ------------- Voice STT -------------
def test_voice_stt_endpoint_accepts_upload(s):
    # Send a tiny dummy webm blob; whisper will likely error, but endpoint should not crash on unrelated path
    fake = io.BytesIO(b"\x1a\x45\xdf\xa3fakewebmdata")
    files = {"file": ("test.webm", fake, "audio/webm")}
    r = s.post(f"{BASE_URL}/api/voice/stt", files=files, timeout=60)
    # Should be structured JSON (either 200 with text, or 500 with detail)
    assert r.status_code in (200, 400, 422, 500), r.status_code
    try:
        j = r.json()
    except Exception:
        pytest.fail(f"STT did not return JSON: {r.text[:200]}")
    assert isinstance(j, dict)


# ------------- Embed loader -------------
def test_embed_loader_valid(s, demo_user_id):
    r = s.get(f"{BASE_URL}/api/embed/{demo_user_id}/loader.js")
    assert r.status_code == 200
    assert "application/javascript" in r.headers.get("content-type", "")
    body = r.text
    assert demo_user_id in body
    assert "/api" in body


def test_embed_loader_invalid_returns_warn(s):
    r = s.get(f"{BASE_URL}/api/embed/nonexistent-tenant-xyz/loader.js")
    assert r.status_code == 200
    assert "console.warn" in r.text


# ------------- Escalate (Twilio mocked) -------------
def test_escalate_mocked(s, demo_user_id):
    payload = {
        "tenant_id": demo_user_id,
        "transcript": [
            {"role": "user", "text": "I need a human agent"},
            {"role": "assistant", "text": "Connecting you now..."},
        ],
    }
    r = s.post(f"{BASE_URL}/api/chat/escalate", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("call_status") == "mocked"
    assert j.get("phone") == "+16195514355"


# ------------- Knowledge files listing -------------
def test_knowledge_files_endpoint(s, demo_token):
    r = s.get(f"{BASE_URL}/api/knowledge/files", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ------------- PDF upload + persistence (RAG content) -------------
def test_pdf_upload_extracts_content(s, demo_token, demo_user_id):
    # Build a minimal PDF with pypdf (in-memory)
    try:
        from pypdf import PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
    except Exception:
        pytest.skip("reportlab not installed - skipping actual pdf upload")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.drawString(100, 750, "Rozio Killer test PDF: refunds are 30 days. FAQ content.")
    c.showPage(); c.save()
    buf.seek(0)
    files = {"file": ("test.pdf", buf, "application/pdf")}
    r = s.post(f"{BASE_URL}/api/knowledge/upload", files=files,
               headers={"Authorization": f"Bearer {demo_token}"}, timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("size", 0) > 0
    # verify list returns it
    lst = s.get(f"{BASE_URL}/api/knowledge/files", headers={"Authorization": f"Bearer {demo_token}"}).json()
    assert any(f["id"] == j["id"] for f in lst)


# ------------- Chat stream doesn't error with tenant id -------------
def test_chat_stream_with_tenant(s, demo_user_id):
    r = s.post(f"{BASE_URL}/api/chat/stream",
               json={"session_id": "test-sess-1", "message": "Hi, what is your refund policy?", "user_id": demo_user_id},
               stream=True, timeout=60)
    assert r.status_code == 200
    got_delta = False
    got_error = False
    for i, line in enumerate(r.iter_lines()):
        if not line: continue
        text = line.decode() if isinstance(line, bytes) else line
        if '"delta"' in text: got_delta = True
        if '"error"' in text: got_error = True
        if '"done"' in text or i > 200: break
    assert not got_error, "chat stream produced error event"
    assert got_delta, "no delta events streamed"


# ------------- Admin login still works -------------
def test_admin_login(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"
