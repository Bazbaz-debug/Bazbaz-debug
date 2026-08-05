"""Iteration 3 tests: avatar endpoints, crawl (real HTML), chat action markers, booking gcal URL."""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://code-sync-108.preview.emergentagent.com').rstrip('/')

DEMO_EMAIL = "demo@client.com"
DEMO_PW = "Demo@12345"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PW})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def demo_uid(s, demo_token):
    r = s.get(f"{BASE_URL}/api/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    return r.json()["id"]


# ---------- Avatar endpoints ----------
@pytest.mark.parametrize("gender", ["male", "female", "neutral"])
def test_public_avatar_returns_image(s, gender):
    r = s.get(f"{BASE_URL}/api/public/avatar/{gender}.jpg", timeout=30)
    assert r.status_code == 200, f"{gender} avatar failed: {r.status_code}"
    ct = r.headers.get("content-type", "")
    assert ("image/jpeg" in ct) or ("image/svg+xml" in ct), f"unexpected CT: {ct}"
    assert len(r.content) > 500, f"body too small: {len(r.content)} bytes"


def test_avatar_profiles_endpoint(s):
    r = s.get(f"{BASE_URL}/api/avatar/profiles", timeout=15)
    assert r.status_code == 200
    j = r.json()
    for g in ("male", "female", "neutral"):
        assert g in j, f"missing {g}"
        assert "image" in j[g]
        assert j[g]["image"].endswith(f"/api/public/avatar/{g}.jpg")


# ---------- Knowledge crawl (real HTML extraction) ----------
def test_crawl_vercel_real_extraction(s, demo_token):
    r = s.post(f"{BASE_URL}/api/knowledge/crawl",
               json={"url": "https://vercel.com"},
               headers={"Authorization": f"Bearer {demo_token}"}, timeout=90)
    assert r.status_code == 200, r.text
    j = r.json()
    # Title should mention Vercel
    title_lower = (j.get("title") or "").lower()
    assert "vercel" in title_lower, f"title doesn't mention vercel: {j.get('title')}"
    items = j.get("products") or []
    assert len(items) >= 3, f"expected >=3 items, got {len(items)}"
    # None of the mock names should appear
    joined = json.dumps(items).lower()
    for banned in ["aurora runner", "nighthawk", "vortex pro"]:
        assert banned not in joined, f"mock name '{banned}' still present in items"


def test_crawl_stripe_works(s, demo_token):
    r = s.post(f"{BASE_URL}/api/knowledge/crawl",
               json={"url": "https://stripe.com"},
               headers={"Authorization": f"Bearer {demo_token}"}, timeout=90)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "stripe" in (j.get("title") or "").lower()
    joined = json.dumps(j.get("products") or []).lower()
    for banned in ["aurora runner", "nighthawk", "vortex pro"]:
        assert banned not in joined


# ---------- Chat action markers ----------
def _collect_stream(s, payload):
    r = s.post(f"{BASE_URL}/api/chat/stream", json=payload, stream=True, timeout=90)
    assert r.status_code == 200
    full = ""
    for line in r.iter_lines():
        if not line:
            continue
        t = line.decode() if isinstance(line, bytes) else line
        if t.startswith("data: "):
            try:
                p = json.loads(t[6:])
                if "delta" in p:
                    full += p["delta"]
                if p.get("done"):
                    break
            except Exception:
                pass
    return full


def test_chat_escalate_marker(s, demo_uid):
    text = _collect_stream(s, {
        "session_id": "escal-sess-1",
        "message": "I want to talk to a real human please",
        "user_id": demo_uid,
    })
    assert "[[ACTION:escalate]]" in text, f"marker missing. Got: {text[:400]}"


def test_chat_book_marker(s, demo_uid):
    sess = "book-sess-1"
    t1 = _collect_stream(s, {
        "session_id": sess,
        "message": "I want to book a slot for tomorrow at 3pm",
        "user_id": demo_uid,
    })
    if "[[ACTION:book:" in t1:
        return
    # follow-up confirmation
    t2 = _collect_stream(s, {
        "session_id": sess,
        "message": "yes tomorrow 3pm please, confirm the booking",
        "user_id": demo_uid,
    })
    assert ("[[ACTION:book:" in t1) or ("[[ACTION:book:" in t2), f"no book marker. t1={t1[:300]} | t2={t2[:300]}"


# ---------- Booking confirm returns google calendar URL ----------
def test_booking_confirm_returns_gcal_url(s, demo_uid):
    r = s.post(f"{BASE_URL}/api/booking/confirm", json={
        "tenant_id": demo_uid,
        "slot": "Tomorrow at 3pm PST",
        "customer_email": "TEST_bookuser@example.com",
    }, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    url = j.get("google_calendar_url", "")
    assert url.startswith("https://www.google.com/calendar/render?action=TEMPLATE"), f"bad url: {url}"
    assert "text=" in url and "dates=" in url


# ---------- me/metrics still works ----------
def test_me_metrics(s, demo_token):
    r = s.get(f"{BASE_URL}/api/me/metrics", headers={"Authorization": f"Bearer {demo_token}"}, timeout=20)
    assert r.status_code == 200
    j = r.json()
    for k in ("chats_today", "bookings_week", "voice_minutes", "conversion_rate"):
        assert k in j


# ---------- profile update still works ----------
def test_profile_update_color(s, demo_token):
    r = s.put(f"{BASE_URL}/api/me/profile",
              json={"bubble_color": "#48BB78"},
              headers={"Authorization": f"Bearer {demo_token}"}, timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True
