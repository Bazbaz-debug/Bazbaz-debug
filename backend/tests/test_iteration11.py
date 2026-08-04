"""Iteration 11 – Messages inbox, public logo endpoint, chat persistence."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://live-bot-preview.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@client.com"
DEMO_PASSWORD = "Demo@12345"
DEMO_TENANT = "3c1aea51-4eac-49fd-8198-cc5bf1e155dc"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8"
    b"\xcf\xc0\x00\x00\x00\x03\x00\x01\x5b\xd6\x2f\x7a\x00\x00\x00\x00IEND\xaeB`\x82"
)


# ---------- BACKEND-1: public logo endpoint ----------
class TestPublicLogo:
    def test_upload_then_public_logo_serves_bytes(self, auth_headers):
        # upload
        files = {"file": ("test.png", PNG_BYTES, "image/png")}
        r = requests.post(f"{BASE_URL}/api/me/logo", headers=auth_headers, files=files, timeout=60)
        assert r.status_code == 200, r.text
        logo_url = r.json()["logo_url"]
        assert f"/api/public/logo/{DEMO_TENANT}" in logo_url

        # public endpoint serves the image
        r2 = requests.get(f"{BASE_URL}/api/public/logo/{DEMO_TENANT}", timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.headers["content-type"].startswith("image/")
        assert len(r2.content) > 0

    def test_public_logo_404_for_missing_tenant(self):
        r = requests.get(f"{BASE_URL}/api/public/logo/{uuid.uuid4()}", timeout=30)
        assert r.status_code == 404

    def test_public_logo_404_when_unset(self, auth_headers):
        # delete then verify 404
        requests.delete(f"{BASE_URL}/api/me/logo", headers=auth_headers, timeout=30)
        r = requests.get(f"{BASE_URL}/api/public/logo/{DEMO_TENANT}", timeout=30)
        assert r.status_code == 404
        # re-upload so widget tests can see logo
        files = {"file": ("test.png", PNG_BYTES, "image/png")}
        requests.post(f"{BASE_URL}/api/me/logo", headers=auth_headers, files=files, timeout=60)


# ---------- BACKEND-3: chat/stream persistence ----------
class TestChatPersistence:
    SESSION_ID = f"qa-test-{uuid.uuid4().hex[:8]}"

    def test_chat_stream_persists(self, auth_headers):
        # drain full stream
        r = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={"session_id": self.SESSION_ID, "message": "Do you ship internationally?", "user_id": DEMO_TENANT},
            stream=True,
            timeout=90,
        )
        assert r.status_code == 200
        for _ in r.iter_lines():
            pass
        time.sleep(1)

        # verify via conversations API
        r2 = requests.get(f"{BASE_URL}/api/messages/conversations", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        convs = r2.json()
        conv = next((c for c in convs if c["session_id"] == self.SESSION_ID), None)
        assert conv is not None, f"conversation for {self.SESSION_ID} not found"
        assert conv.get("msg_count", 0) >= 2
        assert conv.get("status") == "ai"

        # detail endpoint returns messages
        r3 = requests.get(
            f"{BASE_URL}/api/messages/conversations/{self.SESSION_ID}",
            headers=auth_headers,
            timeout=30,
        )
        assert r3.status_code == 200
        detail = r3.json()
        assert "conversation" in detail and "messages" in detail
        roles = [m["role"] for m in detail["messages"]]
        assert "user" in roles
        assert "assistant" in roles


# ---------- BACKEND-2: conversations auth + reply/mark ----------
class TestConversationsAPI:
    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/messages/conversations", timeout=30)
        assert r.status_code in (401, 403)

    def test_detail_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/messages/conversations/whatever", timeout=30)
        assert r.status_code in (401, 403)

    def test_reply_and_mark(self, auth_headers):
        session_id = f"qa-reply-{uuid.uuid4().hex[:8]}"
        # seed a conversation via chat/stream
        r = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={"session_id": session_id, "message": "seed message", "user_id": DEMO_TENANT},
            stream=True,
            timeout=90,
        )
        for _ in r.iter_lines():
            pass
        time.sleep(1)

        # reply
        r2 = requests.post(
            f"{BASE_URL}/api/messages/conversations/{session_id}/reply",
            headers=auth_headers,
            json={"text": "Hi there, this is the owner speaking."},
            timeout=30,
        )
        assert r2.status_code == 200, r2.text

        # verify status flipped to human
        r3 = requests.get(f"{BASE_URL}/api/messages/conversations/{session_id}", headers=auth_headers, timeout=30)
        assert r3.status_code == 200
        assert r3.json()["conversation"]["status"] == "human"
        roles = [m["role"] for m in r3.json()["messages"]]
        assert "human_agent" in roles

        # mark closed
        r4 = requests.post(
            f"{BASE_URL}/api/messages/conversations/{session_id}/mark",
            headers=auth_headers,
            params={"status": "closed"},
            timeout=30,
        )
        assert r4.status_code == 200
        r5 = requests.get(f"{BASE_URL}/api/messages/conversations/{session_id}", headers=auth_headers, timeout=30)
        assert r5.json()["conversation"]["status"] == "closed"

    def test_reply_404_missing(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/messages/conversations/does-not-exist/reply",
            headers=auth_headers,
            json={"text": "hi"},
            timeout=30,
        )
        assert r.status_code == 404
