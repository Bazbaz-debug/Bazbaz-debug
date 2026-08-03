"""Iteration 4 (Phase 7) tests: upload_policy, admin file mgmt, Telnyx/SES/Google stubs, avatar_background."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

ADMIN_EMAIL = "admin@rozio-killer.com"
ADMIN_PW = "Admin@12345"
DEMO_EMAIL = "demo@client.com"
DEMO_PW = "Demo@12345"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PW}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_uid(s, admin_token):
    r = s.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    assert r.status_code == 200
    for u in r.json():
        if u["email"] == DEMO_EMAIL:
            return u["id"]
    pytest.skip("demo user not seeded")


def _admin_h(t): return {"Authorization": f"Bearer {t}"}


# ---------- Public settings surfaces upload_policy + public_signup_enabled ----------
def test_public_settings_exposes_upload_policy(s):
    r = s.get(f"{BASE_URL}/api/settings/public", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "public_signup_enabled" in j
    assert "upload_policy" in j
    assert j["upload_policy"] in ("admin_only", "client_self_serve")


# ---------- Toggle upload_policy admin_only -> knowledge/upload 403 for client -> restore ----------
def test_upload_policy_toggle_enforced(s, admin_token, demo_token):
    # Set to admin_only
    r = s.put(f"{BASE_URL}/api/admin/settings", json={"upload_policy": "admin_only"}, headers=_admin_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text

    r = s.get(f"{BASE_URL}/api/settings/public", timeout=10)
    assert r.json()["upload_policy"] == "admin_only"

    # Demo user upload - should be 403 due to policy
    dummy = io.BytesIO(b"not a real pdf")
    r = s.post(f"{BASE_URL}/api/knowledge/upload",
               files={"file": ("test.pdf", dummy, "application/pdf")},
               headers=_admin_h(demo_token), timeout=30)
    assert r.status_code == 403, f"expected 403 policy enforcement, got {r.status_code}: {r.text}"

    # Restore
    r = s.put(f"{BASE_URL}/api/admin/settings", json={"upload_policy": "client_self_serve"}, headers=_admin_h(admin_token), timeout=15)
    assert r.status_code == 200
    r = s.get(f"{BASE_URL}/api/settings/public", timeout=10)
    assert r.json()["upload_policy"] == "client_self_serve"

    # Now demo upload for non-pdf name should get 400 (policy allows)
    dummy2 = io.BytesIO(b"junk")
    r = s.post(f"{BASE_URL}/api/knowledge/upload",
               files={"file": ("test.txt", dummy2, "text/plain")},
               headers=_admin_h(demo_token), timeout=30)
    # 400 (non-pdf) or 200; must NOT be 403 now
    assert r.status_code != 403, "policy no longer admin_only, should not be 403"


# ---------- Admin upload on behalf of user + delete ----------
_MINI_PDF = (b"%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
             b"2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n"
             b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>endobj\n"
             b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000110 00000 n \n"
             b"trailer<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF")


def test_admin_upload_and_delete_on_behalf(s, admin_token, demo_uid):
    pdf = io.BytesIO(_MINI_PDF)
    r = s.post(f"{BASE_URL}/api/admin/users/{demo_uid}/files/upload",
               files={"file": ("TEST_admin.pdf", pdf, "application/pdf")},
               headers=_admin_h(admin_token), timeout=45)
    assert r.status_code == 200, r.text
    rec = r.json()
    assert rec.get("uploaded_by_admin") is True
    assert rec.get("user_id") == demo_uid
    fid = rec["id"]

    # Delete (soft delete)
    r = s.delete(f"{BASE_URL}/api/admin/files/{fid}", headers=_admin_h(admin_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # Verify not in listing
    r = s.get(f"{BASE_URL}/api/admin/users/{demo_uid}/files", headers=_admin_h(admin_token), timeout=15)
    assert r.status_code == 200
    for f in r.json():
        assert f["id"] != fid, "deleted file still returned in listing"


# ---------- admin/health returns new fields ----------
def test_admin_health_new_fields(s, admin_token):
    r = s.get(f"{BASE_URL}/api/admin/health", headers=_admin_h(admin_token), timeout=15)
    assert r.status_code == 200
    j = r.json()
    for k in ("ses", "telnyx_configured", "telnyx_can_call", "telnyx_phone", "google_oauth"):
        assert k in j, f"missing field {k}: keys={list(j.keys())}"
    # With empty keys these should be false/None
    assert j["ses"] is False
    assert j["telnyx_configured"] is False
    assert j["telnyx_can_call"] is False
    assert j["google_oauth"] is False


# ---------- Google OAuth endpoints ----------
def test_google_oauth_start_400_when_unconfigured(s, demo_token):
    r = s.get(f"{BASE_URL}/api/google/oauth/start", headers=_admin_h(demo_token), timeout=15)
    assert r.status_code == 400
    assert "not configured" in (r.json().get("detail") or "").lower()


def test_google_status_disconnected(s, demo_token):
    r = s.get(f"{BASE_URL}/api/google/status", headers=_admin_h(demo_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("connected") is False


# ---------- Escalation stays mocked, calls collection updated ----------
def test_chat_escalate_mocked_and_persisted(s, demo_uid):
    r = s.post(f"{BASE_URL}/api/chat/escalate", json={
        "tenant_id": demo_uid,
        "transcript": [{"role": "user", "text": "help me pls"}],
    }, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("call_status") == "mocked", f"expected mocked, got {j.get('call_status')}"
    assert j.get("provider") == "mock"


# ---------- Booking confirm returns google_calendar_url + null event_id ----------
def test_booking_returns_gcal_url_no_event(s, demo_uid):
    r = s.post(f"{BASE_URL}/api/booking/confirm", json={
        "tenant_id": demo_uid,
        "slot": "Tomorrow at 3pm",
        "customer_email": "TEST_iter4@example.com",
    }, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("google_calendar_url", "").startswith("https://www.google.com/calendar/render?action=TEMPLATE")
    assert j.get("google_event_id") is None


# ---------- Profile avatar_background persists ----------
def test_avatar_background_persist(s, demo_token):
    r = s.put(f"{BASE_URL}/api/me/profile", json={"avatar_background": "office"},
              headers=_admin_h(demo_token), timeout=15)
    assert r.status_code == 200
    r = s.get(f"{BASE_URL}/api/me", headers=_admin_h(demo_token), timeout=15)
    assert r.status_code == 200
    assert r.json().get("avatar_background") == "office"
    # restore
    s.put(f"{BASE_URL}/api/me/profile", json={"avatar_background": "studio_dark"},
          headers=_admin_h(demo_token), timeout=15)
