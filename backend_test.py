#!/usr/bin/env python3
"""
Backend API tests for Rozio-Killer SaaS Admin Manage-Client endpoints and Twilio API-Key auth.
"""
import requests
import json
import sys

# Read base URL from frontend/.env
BASE_URL = "https://live-bot-preview.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@rozio-killer.com"
ADMIN_PASSWORD = "Admin@12345"
DEMO_EMAIL = "demo@client.com"
DEMO_PASSWORD = "Demo@12345"

def log(msg):
    print(f"[TEST] {msg}")

def test_1_admin_login():
    """Test 1: POST /api/auth/login with admin credentials"""
    log("Test 1: Admin login")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return None, False
    
    data = resp.json()
    if "token" not in data:
        log(f"❌ FAIL: No token in response")
        log(f"Response: {data}")
        return None, False
    
    token = data["token"]
    log(f"✅ PASS: Admin login successful, token: {token[:20]}...")
    return token, True

def test_2_list_users(admin_token):
    """Test 2: GET /api/admin/users with admin Bearer token"""
    log("Test 2: GET /api/admin/users (list)")
    resp = requests.get(f"{BASE_URL}/admin/users", 
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return None, False
    
    users = resp.json()
    if not isinstance(users, list):
        log(f"❌ FAIL: Expected list, got {type(users)}")
        return None, False
    
    # Find demo@client.com
    demo_user = None
    for u in users:
        if u.get("email") == DEMO_EMAIL:
            demo_user = u
            break
    
    if not demo_user:
        log(f"❌ FAIL: demo@client.com not found in user list")
        log(f"Users: {[u.get('email') for u in users]}")
        return None, False
    
    demo_id = demo_user.get("id")
    log(f"✅ PASS: Found demo@client.com with id: {demo_id}")
    return demo_id, True

def test_3_get_user(admin_token, demo_id):
    """Test 3: GET /api/admin/users/{demo_id}"""
    log(f"Test 3: GET /api/admin/users/{demo_id}")
    resp = requests.get(f"{BASE_URL}/admin/users/{demo_id}",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return None, False
    
    user = resp.json()
    
    # Verify no password field
    if "password" in user:
        log(f"❌ FAIL: Password field should not be present")
        return None, False
    
    # Verify has expected fields
    if "email" not in user or "id" not in user:
        log(f"❌ FAIL: Missing expected fields")
        log(f"User: {user}")
        return None, False
    
    log(f"✅ PASS: Got user profile without password field")
    log(f"   Email: {user.get('email')}, Full Name: {user.get('full_name')}")
    return user, True

def test_4_update_user(admin_token, demo_id):
    """Test 4: PUT /api/admin/users/{demo_id} with 8 fields"""
    log(f"Test 4: PUT /api/admin/users/{demo_id} with 8 fields")
    
    update_data = {
        "target_domain": "https://updated-demo.example.com",
        "custom_instruction": "Updated instruction from admin test.",
        "notification_email": "ops+test@client.com",
        "business_owner_phone": "+15551230001",
        "google_email": "demo.owner@gmail.com",
        "zoom_meeting_link": "https://zoom.us/j/9998887777",
        "resend_api_key": "re_test_dummy",
        "custom_smtp_from": "hello@updated-demo.example.com"
    }
    
    resp = requests.put(f"{BASE_URL}/admin/users/{demo_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=update_data, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    result = resp.json()
    
    # Verify response structure
    if not result.get("ok"):
        log(f"❌ FAIL: Expected ok=true")
        log(f"Response: {result}")
        return False
    
    if result.get("updated") != 8:
        log(f"❌ FAIL: Expected updated=8, got {result.get('updated')}")
        log(f"Response: {result}")
        return False
    
    fields = result.get("fields", [])
    if len(fields) != 8:
        log(f"❌ FAIL: Expected 8 fields, got {len(fields)}")
        log(f"Fields: {fields}")
        return False
    
    log(f"✅ PASS: Updated 8 fields successfully")
    log(f"   Fields: {fields}")
    return True

def test_5_verify_update(admin_token, demo_id):
    """Test 5: GET /api/admin/users/{demo_id} again to verify updates"""
    log(f"Test 5: GET /api/admin/users/{demo_id} to verify updates")
    
    resp = requests.get(f"{BASE_URL}/admin/users/{demo_id}",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    user = resp.json()
    
    # Verify all 8 fields
    expected = {
        "target_domain": "https://updated-demo.example.com",
        "custom_instruction": "Updated instruction from admin test.",
        "notification_email": "ops+test@client.com",
        "business_owner_phone": "+15551230001",
        "google_email": "demo.owner@gmail.com",
        "zoom_meeting_link": "https://zoom.us/j/9998887777",
        "resend_api_key": "re_test_dummy",
        "custom_smtp_from": "hello@updated-demo.example.com"
    }
    
    mismatches = []
    for field, expected_value in expected.items():
        actual_value = user.get(field)
        if actual_value != expected_value:
            mismatches.append(f"{field}: expected '{expected_value}', got '{actual_value}'")
    
    if mismatches:
        log(f"❌ FAIL: Field mismatches:")
        for m in mismatches:
            log(f"   {m}")
        return False
    
    log(f"✅ PASS: All 8 fields verified successfully")
    return True

def test_6_demo_login():
    """Test 6: Login as demo client"""
    log("Test 6: Demo client login")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    }, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return None, False
    
    data = resp.json()
    if "token" not in data:
        log(f"❌ FAIL: No token in response")
        log(f"Response: {data}")
        return None, False
    
    token = data["token"]
    log(f"✅ PASS: Demo client login successful, token: {token[:20]}...")
    return token, True

def test_7_demo_update_forbidden(demo_token, demo_id):
    """Test 7: PUT /api/admin/users/{demo_id} with demo (non-admin) token - expect 403"""
    log(f"Test 7: PUT /api/admin/users/{demo_id} with demo token (expect 403)")
    
    resp = requests.put(f"{BASE_URL}/admin/users/{demo_id}",
        headers={"Authorization": f"Bearer {demo_token}"},
        json={"target_domain": "https://hacker.example.com"}, timeout=15)
    
    if resp.status_code != 403:
        log(f"❌ FAIL: Expected 403, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    log(f"✅ PASS: Demo client correctly forbidden (403)")
    return True

def test_8_health_check(admin_token):
    """Test 8: GET /api/admin/health - verify twilio_configured=true"""
    log("Test 8: GET /api/admin/health")
    
    resp = requests.get(f"{BASE_URL}/admin/health",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    health = resp.json()
    
    # Verify twilio_configured is true
    if not health.get("twilio_configured"):
        log(f"❌ FAIL: Expected twilio_configured=true, got {health.get('twilio_configured')}")
        log(f"Health: {health}")
        return False
    
    log(f"✅ PASS: twilio_configured=true")
    log(f"   Health status: {json.dumps(health, indent=2)}")
    return True

# ============= NEW TESTS FOR SHOPIFY EMBED + LIVE SANDBOX =============

def test_9_public_tenant_valid(demo_id):
    """Test 9: GET /api/public/tenant/{demo_id} - unauthenticated, returns safe fields"""
    log(f"Test 9: GET /api/public/tenant/{demo_id} (no auth)")
    
    resp = requests.get(f"{BASE_URL}/public/tenant/{demo_id}", timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    
    # Verify required safe fields are present
    required_fields = [
        "id", "full_name", "bot_name", "bot_tagline", "bot_greeting", "bot_tone",
        "logo_url", "widget_bg", "bubble_color", "accent_color", "avatar_gender",
        "avatar_background", "catalog", "industry"
    ]
    
    missing = []
    for field in required_fields:
        if field not in data:
            missing.append(field)
    
    if missing:
        log(f"❌ FAIL: Missing required fields: {missing}")
        log(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    # Verify sensitive fields are NOT present
    sensitive_fields = [
        "password", "email", "phone", "resend_api_key", "google_api_key",
        "custom_smtp_pass", "custom_smtp_host", "custom_smtp_user",
        "business_hours", "blocked_slots", "business_owner_phone",
        "notification_email", "zoom_meeting_link"
    ]
    
    exposed = []
    for field in sensitive_fields:
        if field in data:
            exposed.append(field)
    
    if exposed:
        log(f"❌ FAIL: Sensitive fields exposed: {exposed}")
        log(f"Response: {json.dumps(data, indent=2)}")
        return False
    
    log(f"✅ PASS: Public tenant endpoint returns safe fields only")
    log(f"   ID: {data.get('id')}, Name: {data.get('full_name')}, Industry: {data.get('industry')}")
    return True

def test_10_public_tenant_not_found():
    """Test 10: GET /api/public/tenant/does-not-exist-xyz - expect 404"""
    log("Test 10: GET /api/public/tenant/does-not-exist-xyz (expect 404)")
    
    resp = requests.get(f"{BASE_URL}/public/tenant/does-not-exist-xyz", timeout=15)
    
    if resp.status_code != 404:
        log(f"❌ FAIL: Expected 404, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    log(f"✅ PASS: Non-existent tenant returns 404")
    return True

def test_11_preview_proxy_valid():
    """Test 11: GET /api/preview/proxy?url=https://example.com - verify base tag, banner, no frame-blocking headers"""
    log("Test 11: GET /api/preview/proxy?url=https://example.com")
    
    resp = requests.get(f"{BASE_URL}/preview/proxy", params={"url": "https://example.com"}, timeout=20)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text[:500]}")
        return False
    
    # Verify content-type is text/html
    content_type = resp.headers.get("content-type", "").lower()
    if "text/html" not in content_type:
        log(f"❌ FAIL: Expected text/html, got {content_type}")
        return False
    
    html = resp.text
    
    # Verify base tag injection
    if '<base href="https://example.com/"' not in html:
        log(f"❌ FAIL: Base tag not found in HTML")
        log(f"HTML preview: {html[:1000]}")
        return False
    
    # Verify banner injection
    if "Rozio-Killer Live Sandbox" not in html:
        log(f"❌ FAIL: Banner text 'Rozio-Killer Live Sandbox' not found")
        log(f"HTML preview: {html[:1000]}")
        return False
    
    # Verify no x-frame-options header (case-insensitive)
    headers_lower = {k.lower(): v for k, v in resp.headers.items()}
    if "x-frame-options" in headers_lower:
        log(f"❌ FAIL: x-frame-options header present: {headers_lower['x-frame-options']}")
        return False
    
    # Verify no restrictive content-security-policy with frame-ancestors
    csp = headers_lower.get("content-security-policy", "")
    if "frame-ancestors" in csp.lower():
        log(f"❌ FAIL: Restrictive CSP with frame-ancestors found: {csp}")
        return False
    
    log(f"✅ PASS: Preview proxy works correctly")
    log(f"   Base tag injected, banner present, no frame-blocking headers")
    return True

def test_12_preview_proxy_invalid_scheme():
    """Test 12: GET /api/preview/proxy?url=ftp://foo - expect 400"""
    log("Test 12: GET /api/preview/proxy?url=ftp://foo (expect 400)")
    
    resp = requests.get(f"{BASE_URL}/preview/proxy", params={"url": "ftp://foo"}, timeout=15)
    
    if resp.status_code != 400:
        log(f"❌ FAIL: Expected 400, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    log(f"✅ PASS: Invalid scheme (ftp://) returns 400")
    return True

def test_13_preview_proxy_nonexistent_domain():
    """Test 13: GET /api/preview/proxy?url=https://this-domain-definitely-does-not-exist-abc123.tld - expect 200 with fallback HTML"""
    log("Test 13: GET /api/preview/proxy?url=https://this-domain-definitely-does-not-exist-abc123.tld")
    
    resp = requests.get(f"{BASE_URL}/preview/proxy", 
        params={"url": "https://this-domain-definitely-does-not-exist-abc123.tld"}, timeout=20)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200 (with fallback), got {resp.status_code}")
        log(f"Response: {resp.text[:500]}")
        return False
    
    html = resp.text
    
    # Verify fallback error HTML contains "Could not load preview"
    if "Could not load preview" not in html:
        log(f"❌ FAIL: Fallback HTML should contain 'Could not load preview'")
        log(f"HTML preview: {html[:1000]}")
        return False
    
    log(f"✅ PASS: Non-existent domain returns 200 with fallback HTML")
    return True

def test_14_embed_loader_js(demo_id):
    """Test 14: GET /api/embed/{demo_id}/loader.js - verify content-type, iframe path, close hook, mobile detection"""
    log(f"Test 14: GET /api/embed/{demo_id}/loader.js")
    
    resp = requests.get(f"{BASE_URL}/embed/{demo_id}/loader.js", timeout=15)
    
    if resp.status_code != 200:
        log(f"❌ FAIL: Expected 200, got {resp.status_code}")
        log(f"Response: {resp.text}")
        return False
    
    # Verify content-type is application/javascript
    content_type = resp.headers.get("content-type", "").lower()
    if "application/javascript" not in content_type:
        log(f"❌ FAIL: Expected application/javascript, got {content_type}")
        return False
    
    js = resp.text
    
    # Verify iframe path contains /embed-widget?tenant=
    if "/embed-widget?tenant=" not in js:
        log(f"❌ FAIL: Iframe path '/embed-widget?tenant=' not found in loader.js")
        log(f"JS preview: {js[:500]}")
        return False
    
    # Verify postMessage close hook contains 'rk:close'
    if "rk:close" not in js:
        log(f"❌ FAIL: postMessage close hook 'rk:close' not found")
        log(f"JS preview: {js[:500]}")
        return False
    
    # Verify mobile detection code (IS_MOBILE)
    if "IS_MOBILE" not in js:
        log(f"❌ FAIL: Mobile detection code 'IS_MOBILE' not found")
        log(f"JS preview: {js[:500]}")
        return False
    
    log(f"✅ PASS: Embed loader.js is correct")
    log(f"   Content-type: application/javascript, iframe path, close hook, mobile detection all present")
    return True

def main():
    log("=" * 60)
    log("Starting Rozio-Killer Backend API Tests")
    log("=" * 60)
    
    results = {}
    
    # Test 1: Admin login
    admin_token, success = test_1_admin_login()
    results["Test 1: Admin login"] = success
    if not success:
        log("❌ Cannot continue without admin token")
        print_summary(results)
        sys.exit(1)
    
    # Test 2: List users
    demo_id, success = test_2_list_users(admin_token)
    results["Test 2: List users"] = success
    if not success:
        log("❌ Cannot continue without demo user ID")
        print_summary(results)
        sys.exit(1)
    
    # Test 3: Get user
    user, success = test_3_get_user(admin_token, demo_id)
    results["Test 3: Get user profile"] = success
    
    # Test 4: Update user
    success = test_4_update_user(admin_token, demo_id)
    results["Test 4: Update user (8 fields)"] = success
    
    # Test 5: Verify update
    success = test_5_verify_update(admin_token, demo_id)
    results["Test 5: Verify updates"] = success
    
    # Test 6: Demo login
    demo_token, success = test_6_demo_login()
    results["Test 6: Demo client login"] = success
    if not success:
        log("⚠️  Cannot test demo forbidden without demo token")
    else:
        # Test 7: Demo update forbidden
        success = test_7_demo_update_forbidden(demo_token, demo_id)
        results["Test 7: Demo update forbidden (403)"] = success
    
    # Test 8: Health check
    success = test_8_health_check(admin_token)
    results["Test 8: Health check (twilio_configured)"] = success
    
    # ============= NEW TESTS FOR SHOPIFY EMBED + LIVE SANDBOX =============
    log("")
    log("=" * 60)
    log("NEW TESTS: Shopify Embed + Live Sandbox")
    log("=" * 60)
    
    # Test 9: Public tenant endpoint - valid
    success = test_9_public_tenant_valid(demo_id)
    results["Test 9: Public tenant (valid)"] = success
    
    # Test 10: Public tenant endpoint - not found
    success = test_10_public_tenant_not_found()
    results["Test 10: Public tenant (404)"] = success
    
    # Test 11: Preview proxy - valid URL
    success = test_11_preview_proxy_valid()
    results["Test 11: Preview proxy (valid URL)"] = success
    
    # Test 12: Preview proxy - invalid scheme
    success = test_12_preview_proxy_invalid_scheme()
    results["Test 12: Preview proxy (invalid scheme)"] = success
    
    # Test 13: Preview proxy - non-existent domain
    success = test_13_preview_proxy_nonexistent_domain()
    results["Test 13: Preview proxy (non-existent domain)"] = success
    
    # Test 14: Embed loader.js
    success = test_14_embed_loader_js(demo_id)
    results["Test 14: Embed loader.js"] = success
    
    print_summary(results)
    
    # Exit with error code if any test failed
    if not all(results.values()):
        sys.exit(1)

def print_summary(results):
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        log(f"{status}: {test_name}")
    log("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    log(f"Results: {passed}/{total} tests passed")
    log("=" * 60)

if __name__ == "__main__":
    main()
