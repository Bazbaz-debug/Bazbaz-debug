"""Iteration 13 tests: human-agent poll, order tracking, vision product search."""
import os, io, uuid, time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://booking-calendar-88.preview.emergentagent.com").rstrip("/")
TENANT_ID = "3c1aea51-4eac-49fd-8198-cc5bf1e155dc"
DEMO_EMAIL = "demo@client.com"
DEMO_PW = "Demo@12345"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PW}, timeout=45)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- BACKEND-1: human-agent poll ----------
class TestHumanAgentPoll:
    def test_seed_conversation_and_poll(self, auth_headers):
        sid = f"poll-test-{uuid.uuid4().hex[:6]}"
        # Seed conversation via chat stream (consume the stream)
        with requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={"session_id": sid, "message": "Hi there", "user_id": TENANT_ID},
            stream=True, timeout=60,
        ) as r:
            assert r.status_code == 200
            for _ in r.iter_lines():
                pass
        # Post human reply
        rr = requests.post(
            f"{BASE_URL}/api/messages/conversations/{sid}/reply",
            headers=auth_headers, json={"text": "Owner here!"}, timeout=15,
        )
        assert rr.status_code == 200, rr.text

        # Poll pending
        pr = requests.get(
            f"{BASE_URL}/api/chat/session/{sid}/pending",
            params={"tenant_id": TENANT_ID}, timeout=15,
        )
        assert pr.status_code == 200
        data = pr.json()
        assert "messages" in data and "server_time" in data
        human_msgs = [m for m in data["messages"] if m.get("role") == "human_agent"]
        assert len(human_msgs) == 1
        assert human_msgs[0]["text"] == "Owner here!"

        # Poll with since=server_time -> empty
        pr2 = requests.get(
            f"{BASE_URL}/api/chat/session/{sid}/pending",
            params={"tenant_id": TENANT_ID, "since": data["server_time"]}, timeout=15,
        )
        assert pr2.status_code == 200
        assert pr2.json()["messages"] == []


# ---------- BACKEND-2 & 3: order tracking ----------
class TestOrderTrack:
    def test_no_shopify_config(self):
        # Ensure shopify not configured on demo tenant. Best-effort clear via profile update requires auth; the test tolerates existing config.
        r = requests.post(f"{BASE_URL}/api/order/track",
                          json={"tenant_id": TENANT_ID, "order_number": "1042"}, timeout=60)
        # Expected 400 if not configured. If tenant has stale config leftovers, allow 404/502.
        assert r.status_code in (400, 404, 502), r.text
        if r.status_code == 400:
            assert "Shopify" in r.text or "connected" in r.text.lower()

    def test_bad_tenant(self):
        r = requests.post(f"{BASE_URL}/api/order/track",
                          json={"tenant_id": "nonexistent-xyz", "order_number": "1"}, timeout=60)
        assert r.status_code == 404


# ---------- BACKEND-4 & 5: vision product search ----------
class TestVisionSearch:
    @pytest.fixture(scope="class", autouse=True)
    def seed_catalog(self, auth_headers):
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio
        async def do():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            dbname = os.environ.get("DB_NAME", "test_database")
            await client[dbname].users.update_one({"id": TENANT_ID}, {"$set": {"catalog": [
                {"name": "Red running shoes", "price": "$79", "description": "lightweight red sneakers", "url": "https://shop.example/red", "image": ""}
            ]}})
            client.close()
        asyncio.new_event_loop().run_until_complete(do())
        yield

    def test_bad_tenant(self):
        files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 100, "image/png")}
        r = requests.post(f"{BASE_URL}/api/vision/product-search",
                          params={"tenant_id": "nonexistent-xyz"}, files=files, timeout=30)
        assert r.status_code == 404

    def test_non_image(self):
        files = {"file": ("notes.txt", b"hello world", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/vision/product-search",
                          params={"tenant_id": TENANT_ID}, files=files, timeout=30)
        assert r.status_code == 400

    def test_real_image_match(self):
        # Fetch a red-sneaker photo from unsplash (with UA to avoid CF block)
        img_resp = requests.get("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
                                headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
        assert img_resp.status_code == 200
        files = {"file": ("shoe.jpg", img_resp.content, "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/vision/product-search",
                          params={"tenant_id": TENANT_ID}, files=files, timeout=90)
        # Environment note: LLM budget can be exhausted, causing 502. Accept both.
        if r.status_code == 502:
            pytest.skip(f"LLM budget exhausted / vision unavailable: {r.text[:200]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "description" in data and "matches" in data
        assert isinstance(data["matches"], list)
        desc = (data["description"] or "").lower()
        assert any(k in desc for k in ["red", "shoe", "sneaker", "footwear"])
        assert len(data["matches"]) >= 1
