"""
Iteration 10 tests: Booking rules, bot customization, logo upload, chat/stream regression.
Covers PUT /me/profile new fields, GET /booking/available-slots, POST /booking/confirm rules,
POST/DELETE /me/logo, and regression on auth/me/admin.
"""
import io
import os
import struct
import zlib
import json
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://code-sync-108.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@rozio-killer.com"
ADMIN_PW = "Admin@12345"
DEMO_EMAIL = "demo@client.com"
DEMO_PW = "Demo@12345"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def demo_auth():
    data = _login(DEMO_EMAIL, DEMO_PW)
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


@pytest.fixture(scope="module")
def admin_auth():
    data = _login(ADMIN_EMAIL, ADMIN_PW)
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


def _make_png_bytes():
    # 1x1 red PNG
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b'\x00\xff\x00\x00'
    idat = zlib.compress(raw)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')


# ---------- Regression: auth + me + admin ----------
class TestRegressionAuth:
    def test_admin_login(self):
        d = _login(ADMIN_EMAIL, ADMIN_PW)
        assert d["user"]["role"] == "admin"
        assert d["user"]["email"] == ADMIN_EMAIL

    def test_demo_login(self):
        d = _login(DEMO_EMAIL, DEMO_PW)
        assert d["user"]["role"] == "client"

    def test_login_bad_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_endpoint(self, demo_auth):
        r = requests.get(f"{API}/me", headers=demo_auth["headers"], timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == DEMO_EMAIL
        assert "password" not in j
        assert "_id" not in j

    def test_admin_users_list(self, admin_auth):
        r = requests.get(f"{API}/admin/users", headers=admin_auth["headers"], timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert any(u["email"] == DEMO_EMAIL for u in users)

    def test_admin_update_user(self, admin_auth, demo_auth):
        uid = demo_auth["user"]["id"]
        r = requests.put(f"{API}/admin/users/{uid}", headers=admin_auth["headers"],
                         json={"industry": "Retail"}, timeout=15)
        assert r.status_code == 200


# ---------- PUT /me/profile new fields + GET /me ----------
class TestProfileNewFields:
    def test_update_and_persist_all_new_fields(self, demo_auth):
        payload = {
            "business_hours": {
                "mon": {"start": "09:00", "end": "17:00", "enabled": True},
                "tue": {"start": "09:00", "end": "17:00", "enabled": True},
                "wed": {"start": "09:00", "end": "17:00", "enabled": True},
                "thu": {"start": "09:00", "end": "17:00", "enabled": True},
                "fri": {"start": "09:00", "end": "17:00", "enabled": True},
                "sat": {"start": "10:00", "end": "14:00", "enabled": False},
                "sun": {"start": "10:00", "end": "14:00", "enabled": False},
            },
            "meeting_duration": 30,
            "business_timezone": "America/New_York",
            "blocked_slots": [{"date": "2026-08-11", "start": "14:00", "end": "16:00", "note": "lunch"}],
            "recurring_blocks": [{"day": "friday", "start": "15:00", "end": "23:59"}],
            "zoom_meeting_link": "https://zoom.us/j/123456",
            "bot_name": "Aria",
            "bot_greeting": "Hey, how can I help?",
            "bot_tone": "friendly",
            "bot_tagline": "Your concierge",
            "logo_url": "",  # cleared for now
        }
        r = requests.put(f"{API}/me/profile", headers=demo_auth["headers"], json=payload, timeout=20)
        assert r.status_code == 200, r.text

        r2 = requests.get(f"{API}/me", headers=demo_auth["headers"], timeout=15)
        assert r2.status_code == 200
        m = r2.json()
        assert m["meeting_duration"] == 30
        assert m["business_timezone"] == "America/New_York"
        assert m["zoom_meeting_link"] == "https://zoom.us/j/123456"
        assert m["bot_name"] == "Aria"
        assert m["bot_greeting"] == "Hey, how can I help?"
        assert m["bot_tone"] == "friendly"
        assert m["bot_tagline"] == "Your concierge"
        assert m["business_hours"]["sat"]["enabled"] is False
        assert m["blocked_slots"][0]["date"] == "2026-08-11"
        assert m["recurring_blocks"][0]["day"] == "friday"


# ---------- GET /api/booking/available-slots ----------
class TestAvailableSlots:
    def test_available_slots_respects_config(self, demo_auth):
        tid = demo_auth["user"]["id"]
        r = requests.get(f"{API}/booking/available-slots", params={"tenant_id": tid, "days": 7}, timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert j["meeting_duration"] == 30
        slots = j["slots"]
        assert isinstance(slots, list)
        assert len(slots) > 0

        # No slot should be on Sat/Sun (disabled)
        for s in slots:
            dt = datetime.fromisoformat(s["start_iso"].replace("Z", "+00:00"))
            wd = dt.weekday()
            assert wd < 5, f"Slot on disabled weekend day: {s}"
            # Business hours 09:00-17:00 UTC
            assert 9 <= dt.hour < 17
            # If it's a Friday, must NOT be inside 15:00-23:59 (recurring block)
            if wd == 4:
                assert dt.hour < 15, f"Friday slot inside recurring block: {s}"
            # If date matches blocked_slots 2026-08-11 14:00-16:00 -> excluded
            if dt.date().isoformat() == "2026-08-11":
                assert not (14 <= dt.hour < 16), f"Slot inside one-off block: {s}"

    def test_available_slots_bad_tenant(self):
        r = requests.get(f"{API}/booking/available-slots", params={"tenant_id": "nope", "days": 7}, timeout=15)
        assert r.status_code == 404


# ---------- POST /api/booking/confirm rule enforcement ----------
class TestBookingConfirm:
    def _next_weekday(self, target_wd):
        d = datetime.now(timezone.utc).date()
        for i in range(1, 14):
            nd = d + timedelta(days=i)
            if nd.weekday() == target_wd:
                return nd
        return d

    def test_reject_closed_day_saturday(self, demo_auth):
        tid = demo_auth["user"]["id"]
        sat = self._next_weekday(5)  # Saturday
        slot = f"{sat.isoformat()}T10:00:00Z"
        r = requests.post(f"{API}/booking/confirm",
                          json={"slot": slot, "customer_email": "cust@test.com", "tenant_id": tid}, timeout=20)
        assert r.status_code == 400
        assert "closed" in r.text.lower()

    def test_reject_outside_hours(self, demo_auth):
        tid = demo_auth["user"]["id"]
        tue = self._next_weekday(1)
        slot = f"{tue.isoformat()}T06:00:00Z"  # before 09:00
        r = requests.post(f"{API}/booking/confirm",
                          json={"slot": slot, "customer_email": "cust@test.com", "tenant_id": tid}, timeout=20)
        assert r.status_code == 400
        assert "hours" in r.text.lower()

    def test_reject_blocked_slot(self, demo_auth):
        tid = demo_auth["user"]["id"]
        # blocked_slots: 2026-08-11 14:00-16:00. 2026-08-11 is Tuesday.
        slot = "2026-08-11T14:30:00Z"
        r = requests.post(f"{API}/booking/confirm",
                          json={"slot": slot, "customer_email": "cust@test.com", "tenant_id": tid}, timeout=20)
        assert r.status_code == 400
        assert "blocked" in r.text.lower()

    def test_accept_valid_slot(self, demo_auth):
        tid = demo_auth["user"]["id"]
        # Tuesday 10:00 UTC on 2026-08-11 (Tue), but that has a block 14-16 not at 10. Use 10:00.
        slot = "2026-08-11T10:00:00Z"
        r = requests.post(f"{API}/booking/confirm",
                          json={"slot": slot, "customer_email": "cust@test.com",
                                "customer_name": "Test Cust", "customer_phone": "+15551112222",
                                "tenant_id": tid}, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert "booking" in j
        assert j["zoom_link"] == "https://zoom.us/j/123456"
        assert "google_calendar_url" in j
        assert j["google_calendar_url"].startswith("https://www.google.com/calendar/render")
        assert j["start_iso"].startswith("2026-08-11T10:00")
        # duration 30 min
        s = datetime.fromisoformat(j["start_iso"].replace("Z", "+00:00"))
        e = datetime.fromisoformat(j["end_iso"].replace("Z", "+00:00"))
        assert (e - s).total_seconds() == 30 * 60


# ---------- Logo upload / delete ----------
class TestLogo:
    def test_upload_and_delete_logo(self, demo_auth):
        png = _make_png_bytes()
        files = {"file": ("logo.png", png, "image/png")}
        r = requests.post(f"{API}/me/logo", headers=demo_auth["headers"], files=files, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert isinstance(j["logo_url"], str) and len(j["logo_url"]) > 0

        # Verify GET /me reflects it
        me = requests.get(f"{API}/me", headers=demo_auth["headers"], timeout=15).json()
        assert me.get("logo_url") == j["logo_url"]

        # Delete
        r2 = requests.delete(f"{API}/me/logo", headers=demo_auth["headers"], timeout=15)
        assert r2.status_code == 200
        assert r2.json()["ok"] is True

        # Verify cleared
        me2 = requests.get(f"{API}/me", headers=demo_auth["headers"], timeout=15).json()
        assert not me2.get("logo_url")

    def test_reject_bad_extension(self, demo_auth):
        files = {"file": ("evil.exe", b"x" * 100, "application/octet-stream")}
        r = requests.post(f"{API}/me/logo", headers=demo_auth["headers"], files=files, timeout=15)
        assert r.status_code == 400


# ---------- Chat stream reachability ----------
class TestChatStream:
    def test_chat_stream_reachable(self, demo_auth):
        tid = demo_auth["user"]["id"]
        payload = {"session_id": f"test-sess-{int(time.time())}", "message": "hello", "user_id": tid}
        with requests.post(f"{API}/chat/stream", json=payload, stream=True, timeout=30) as r:
            assert r.status_code == 200
            got_any = False
            error_frame = None
            deadline = time.time() + 15
            for raw in r.iter_lines():
                if time.time() > deadline:
                    break
                if not raw:
                    continue
                got_any = True
                line = raw.decode("utf-8", "ignore")
                if line.startswith("data:"):
                    try:
                        data = json.loads(line[5:].strip())
                        if "error" in data:
                            error_frame = data["error"]
                            break
                        if data.get("done"):
                            break
                    except Exception:
                        continue
            assert got_any, "No SSE frames received"
            if error_frame:
                # Endpoint healthy but LLM may fail; log for context. Do NOT fail the reachability test.
                print(f"[warn] chat/stream returned error frame: {error_frame}")
