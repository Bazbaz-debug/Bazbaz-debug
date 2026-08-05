"""Iteration 14 - Rozio-Killer SaaS backend (master admin, integrations hub,
impersonation, audit log, training center, metrics/activity).
"""
import os
import pytest
import requests

def _get_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # read from frontend/.env
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    return url.rstrip("/") + "/api"


BASE_URL = _get_base_url()

ADMIN_EMAIL = "baazisufi23@gmail.com"
ADMIN_PASS = "Bigbaaz23"
CLIENT_EMAIL = "demo@client.com"
CLIENT_PASS = "Demo@12345"


def _login(email, password, retries=3):
    last = None
    for _ in range(retries):
        try:
            r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=90)
            if r.status_code < 500:
                return r
            last = r
        except requests.exceptions.RequestException as e:
            last = e
    if isinstance(last, requests.Response):
        return last
    raise last


# ---------- AUTH ----------
class TestAuth:
    def test_master_admin_login(self):
        r = _login(ADMIN_EMAIL, ADMIN_PASS)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert d["user"]["email"] == ADMIN_EMAIL
        assert isinstance(d["token"], str) and len(d["token"]) > 10

    def test_whitespace_and_case_email_login(self):
        r = _login("  BAAZISUFI23@gmail.com  ", ADMIN_PASS)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_password_space_preserved(self):
        # correct password has no space -> adding one must fail
        r = _login(ADMIN_EMAIL, " " + ADMIN_PASS + " ")
        assert r.status_code == 401, f"Password whitespace must NOT be trimmed: {r.status_code}"

    def test_old_admin_removed(self):
        r = _login("admin@rozio.ai", "Admin@12345")
        assert r.status_code == 401, f"Old admin should be removed: got {r.status_code}"

    def test_demo_client_login(self):
        r = _login(CLIENT_EMAIL, CLIENT_PASS)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "client"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASS)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = _login(CLIENT_EMAIL, CLIENT_PASS)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_id():
    r = _login(CLIENT_EMAIL, CLIENT_PASS)
    return r.json()["user"]["id"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- METRICS / ACTIVITY ----------
class TestMetricsActivity:
    def test_me_metrics(self, client_token):
        r = requests.get(f"{BASE_URL}/me/metrics", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # keys are present
        for k in ("chats_today", "bookings_week", "voice_minutes", "conversion_rate"):
            assert k in d, f"missing key {k} in {d}"

    def test_me_activity_sample(self, client_token):
        r = requests.get(f"{BASE_URL}/me/activity", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "events" in d or "items" in d or "activity" in d, d
        events = d.get("events") or d.get("items") or d.get("activity") or []
        assert isinstance(events, list) and len(events) > 0, d
        # sample flag for fresh workspace
        assert d.get("is_sample") in (True, False)


# ---------- INTEGRATIONS HUB ----------
class TestIntegrations:
    def test_list_default(self, client_token):
        r = requests.get(f"{BASE_URL}/me/integrations", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "integrations" in d
        providers = {i["provider"] for i in d["integrations"]}
        # Roadmap expects at least these
        for p in ("zoom", "calendly", "slack", "stripe", "hubspot"):
            assert p in providers, f"missing provider {p} in {providers}"

    def test_save_and_mask_zoom(self, client_token):
        secret = "supersecretzoomkey123456ABCD"
        r = requests.put(
            f"{BASE_URL}/me/integrations",
            headers=_h(client_token),
            json={"provider": "zoom", "values": {"api_key": secret, "api_secret": "secretVALUE0987"}},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Verify masked
        r2 = requests.get(f"{BASE_URL}/me/integrations", headers=_h(client_token), timeout=15)
        assert r2.status_code == 200
        zoom = next(i for i in r2.json()["integrations"] if i["provider"] == "zoom")
        assert zoom["connected"] is True
        masked = zoom["masked"]
        # plaintext must NOT leak
        assert secret not in str(masked), f"Plaintext leaked: {masked}"
        assert "api_key" in masked
        # Masked form should contain bullets or partial
        assert "•" in masked["api_key"] or "*" in masked["api_key"] or masked["api_key"].endswith(secret[-4:])


# ---------- IMPERSONATION ----------
class TestImpersonation:
    def test_impersonate_flow(self, admin_token, client_id):
        r = requests.post(f"{BASE_URL}/admin/impersonate/{client_id}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d
        assert d["user"]["id"] == client_id
        # The impersonation token should authenticate as the client
        me = requests.get(f"{BASE_URL}/me", headers=_h(d["token"]), timeout=15)
        assert me.status_code == 200
        assert me.json()["id"] == client_id

    def test_impersonate_forbidden_for_non_admin(self, client_token, client_id):
        r = requests.post(f"{BASE_URL}/admin/impersonate/{client_id}", headers=_h(client_token), timeout=15)
        assert r.status_code in (401, 403)


# ---------- AUDIT LOG ----------
class TestAudit:
    def test_audit_lists_impersonate_and_integration(self, admin_token):
        r = requests.get(f"{BASE_URL}/admin/audit", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        logs = r.json().get("logs", [])
        actions = {l.get("action") for l in logs}
        assert "impersonate.start" in actions, f"expected impersonate.start in {actions}"
        assert "integration.save" in actions, f"expected integration.save in {actions}"

    def test_audit_search(self, admin_token):
        r = requests.get(f"{BASE_URL}/admin/audit", headers=_h(admin_token), params={"q": "impersonate"}, timeout=15)
        assert r.status_code == 200
        logs = r.json().get("logs", [])
        for l in logs:
            joined = f"{l.get('action','')} {l.get('actor_email','')} {l.get('target','')}".lower()
            assert "impersonate" in joined, l


# ---------- TRAINING CENTER ----------
class TestTraining:
    def test_correct_persists(self, client_token):
        payload = {
            "question": "TEST_What are your hours?",
            "original": "We are closed.",
            "corrected": "TEST_We are open 9am-5pm Mon-Fri.",
        }
        r = requests.post(f"{BASE_URL}/me/training/correct", headers=_h(client_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        cid = d["correction"]["id"]

        # Appears in list
        r2 = requests.get(f"{BASE_URL}/me/training/corrections", headers=_h(client_token), timeout=15)
        assert r2.status_code == 200
        found = next((c for c in r2.json()["corrections"] if c["id"] == cid), None)
        assert found is not None, "correction did not persist"
        assert found["corrected"] == payload["corrected"]

        # cleanup
        requests.delete(f"{BASE_URL}/me/training/corrections/{cid}", headers=_h(client_token), timeout=15)

    def test_transcripts_endpoint(self, client_token):
        r = requests.get(f"{BASE_URL}/me/training/transcripts", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        assert "transcripts" in r.json()


# ---------- ADMIN HEALTH ----------
class TestAdminHealth:
    def test_admin_health(self, admin_token):
        r = requests.get(f"{BASE_URL}/admin/health", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
