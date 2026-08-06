#!/usr/bin/env python3
"""
Per-Client Keys Endpoints Test
Tests GET/PUT /api/me/platform-keys with isolation, masking, and auth enforcement
"""
import requests
import time
import sys

# Use the public backend URL from frontend/.env
BASE_URL = "https://9637df82-16ce-40a3-8b4b-1ea16e526f30.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "baazisufi23@gmail.com"
ADMIN_PASSWORD = "Bigbaaz23"
DEMO_EMAIL = "demo@client.com"
DEMO_PASSWORD = "Demo@12345"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def log_test(name, status, details="", timing=""):
    symbol = f"{Colors.GREEN}✓{Colors.RESET}" if status else f"{Colors.RED}✗{Colors.RESET}"
    timing_str = f" ({Colors.BLUE}{timing}{Colors.RESET})" if timing else ""
    print(f"{symbol} {name}{timing_str}")
    if details:
        print(f"  {details}")

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user")
        return None, None
    except Exception as e:
        print(f"{Colors.RED}Login failed: {str(e)}{Colors.RESET}")
        return None, None

def test_1_get_initial_keys(demo_token):
    """Test 1: GET /api/me/platform-keys with demo client token"""
    print(f"\n{Colors.YELLOW}=== Test 1: GET /api/me/platform-keys (demo client) ==={Colors.RESET}")
    
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("GET /api/me/platform-keys", False, f"Status: {response.status_code}, Response: {response.text[:200]}", f"{elapsed:.2f}s")
            return False
        
        data = response.json()
        categories = data.get("categories", [])
        
        # Check for 5 categories
        category_names = [cat.get("category") for cat in categories]
        expected_categories = ["email", "calendar", "messaging", "voice", "chat"]
        has_all_categories = all(cat in category_names for cat in expected_categories)
        
        if not has_all_categories:
            log_test("GET /api/me/platform-keys", False, f"Missing categories. Found: {category_names}, Expected: {expected_categories}", f"{elapsed:.2f}s")
            return False
        
        # Check structure of each category
        all_valid = True
        for cat in categories:
            fields = cat.get("fields", [])
            for field in fields:
                required_keys = ["key", "label", "secret", "configured", "value"]
                if not all(k in field for k in required_keys):
                    all_valid = False
                    log_test("GET /api/me/platform-keys", False, f"Field missing required keys: {field}", f"{elapsed:.2f}s")
                    return False
        
        log_test("GET /api/me/platform-keys (demo client)", True, f"Status: 200, Categories: {len(categories)}, All fields have required structure", f"{elapsed:.2f}s")
        return True, data
        
    except Exception as e:
        log_test("GET /api/me/platform-keys", False, f"Error: {str(e)}")
        return False

def test_2_put_keys(demo_token):
    """Test 2: PUT /api/me/platform-keys with demo client token"""
    print(f"\n{Colors.YELLOW}=== Test 2: PUT /api/me/platform-keys (demo client) ==={Colors.RESET}")
    
    test_values = {
        "resend_api_key": "re_democlient_AAA111",
        "sender_email": "owner@demoshop.com",
        "telnyx_api_key": "KEYdemo999",
        "telnyx_phone_number": "+15551230000",
        "llm_api_key": "sk-demo-xyz"
    }
    
    try:
        start = time.time()
        response = requests.put(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"values": test_values},
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("PUT /api/me/platform-keys", False, f"Status: {response.status_code}, Response: {response.text[:200]}", f"{elapsed:.2f}s")
            return False
        
        data = response.json()
        ok = data.get("ok", False)
        saved = data.get("saved", [])
        
        if not ok:
            log_test("PUT /api/me/platform-keys", False, f"ok=False in response", f"{elapsed:.2f}s")
            return False
        
        if len(saved) != 5:
            log_test("PUT /api/me/platform-keys", False, f"Expected 5 saved fields, got {len(saved)}: {saved}", f"{elapsed:.2f}s")
            return False
        
        log_test("PUT /api/me/platform-keys (demo client)", True, f"Status: 200, ok=true, saved={len(saved)} fields: {saved}", f"{elapsed:.2f}s")
        return True
        
    except Exception as e:
        log_test("PUT /api/me/platform-keys", False, f"Error: {str(e)}")
        return False

def test_3_get_masked_keys(demo_token):
    """Test 3: GET /api/me/platform-keys again - verify masking and values"""
    print(f"\n{Colors.YELLOW}=== Test 3: GET /api/me/platform-keys (verify masking) ==={Colors.RESET}")
    
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("GET /api/me/platform-keys (verify masking)", False, f"Status: {response.status_code}", f"{elapsed:.2f}s")
            return False
        
        data = response.json()
        categories = data.get("categories", [])
        
        # Find specific fields
        all_fields = {}
        for cat in categories:
            for field in cat.get("fields", []):
                all_fields[field["key"]] = field
        
        # Check resend_api_key: configured=true, value masked
        resend = all_fields.get("resend_api_key")
        if not resend:
            log_test("GET /api/me/platform-keys (verify masking)", False, "resend_api_key field not found")
            return False
        
        if not resend.get("configured"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"resend_api_key configured={resend.get('configured')}, expected True")
            return False
        
        if not resend.get("value", "").startswith("••••"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"resend_api_key value not masked: {resend.get('value')}")
            return False
        
        # Check sender_email: plain value
        sender = all_fields.get("sender_email")
        if not sender:
            log_test("GET /api/me/platform-keys (verify masking)", False, "sender_email field not found")
            return False
        
        if sender.get("value") != "owner@demoshop.com":
            log_test("GET /api/me/platform-keys (verify masking)", False, f"sender_email value={sender.get('value')}, expected 'owner@demoshop.com'")
            return False
        
        # Check telnyx_api_key: configured=true, value masked
        telnyx_key = all_fields.get("telnyx_api_key")
        if not telnyx_key:
            log_test("GET /api/me/platform-keys (verify masking)", False, "telnyx_api_key field not found")
            return False
        
        if not telnyx_key.get("configured"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"telnyx_api_key configured={telnyx_key.get('configured')}, expected True")
            return False
        
        if not telnyx_key.get("value", "").startswith("••••"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"telnyx_api_key value not masked: {telnyx_key.get('value')}")
            return False
        
        # Check telnyx_phone_number: plain value
        telnyx_phone = all_fields.get("telnyx_phone_number")
        if not telnyx_phone:
            log_test("GET /api/me/platform-keys (verify masking)", False, "telnyx_phone_number field not found")
            return False
        
        if telnyx_phone.get("value") != "+15551230000":
            log_test("GET /api/me/platform-keys (verify masking)", False, f"telnyx_phone_number value={telnyx_phone.get('value')}, expected '+15551230000'")
            return False
        
        # Check llm_api_key: configured=true, value masked
        llm_key = all_fields.get("llm_api_key")
        if not llm_key:
            log_test("GET /api/me/platform-keys (verify masking)", False, "llm_api_key field not found")
            return False
        
        if not llm_key.get("configured"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"llm_api_key configured={llm_key.get('configured')}, expected True")
            return False
        
        if not llm_key.get("value", "").startswith("••••"):
            log_test("GET /api/me/platform-keys (verify masking)", False, f"llm_api_key value not masked: {llm_key.get('value')}")
            return False
        
        log_test("GET /api/me/platform-keys (verify masking)", True, 
                 f"All secrets masked correctly (resend, telnyx_api_key, llm_api_key), plain values correct (sender_email, telnyx_phone_number)", 
                 f"{elapsed:.2f}s")
        return True, all_fields
        
    except Exception as e:
        log_test("GET /api/me/platform-keys (verify masking)", False, f"Error: {str(e)}")
        return False

def test_4_idempotent_masked_put(demo_token, masked_fields):
    """Test 4: PUT with masked value should NOT wipe the secret"""
    print(f"\n{Colors.YELLOW}=== Test 4: Idempotent masked PUT ==={Colors.RESET}")
    
    # Get the masked value for resend_api_key
    resend_masked = masked_fields.get("resend_api_key", {}).get("value", "")
    
    if not resend_masked.startswith("••••"):
        log_test("Idempotent masked PUT", False, f"Cannot test: resend_api_key not masked: {resend_masked}")
        return False
    
    # PUT with the masked value
    try:
        start = time.time()
        response = requests.put(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"values": {"resend_api_key": resend_masked}},
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("Idempotent masked PUT", False, f"Status: {response.status_code}", f"{elapsed:.2f}s")
            return False
        
        # Now GET again and verify resend_api_key is still configured
        response2 = requests.get(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=10
        )
        
        if response2.status_code != 200:
            log_test("Idempotent masked PUT", False, f"GET after PUT failed: {response2.status_code}")
            return False
        
        data2 = response2.json()
        categories = data2.get("categories", [])
        
        all_fields = {}
        for cat in categories:
            for field in cat.get("fields", []):
                all_fields[field["key"]] = field
        
        resend = all_fields.get("resend_api_key")
        if not resend or not resend.get("configured"):
            log_test("Idempotent masked PUT", False, f"resend_api_key was wiped! configured={resend.get('configured') if resend else 'N/A'}")
            return False
        
        log_test("Idempotent masked PUT", True, 
                 f"PUT with masked value did NOT wipe secret (configured still True)", 
                 f"{elapsed:.2f}s")
        return True
        
    except Exception as e:
        log_test("Idempotent masked PUT", False, f"Error: {str(e)}")
        return False

def test_5_auth_enforcement():
    """Test 5: Auth enforcement - no token should return 401/403"""
    print(f"\n{Colors.YELLOW}=== Test 5: Auth enforcement ==={Colors.RESET}")
    
    results = []
    
    # GET with no token
    try:
        response = requests.get(f"{BASE_URL}/me/platform-keys", timeout=10)
        is_401_or_403 = response.status_code in [401, 403]
        log_test("GET /api/me/platform-keys with NO token", is_401_or_403, f"Status: {response.status_code}")
        results.append(is_401_or_403)
    except Exception as e:
        log_test("GET /api/me/platform-keys with NO token", False, f"Error: {str(e)}")
        results.append(False)
    
    # PUT with no token
    try:
        response = requests.put(
            f"{BASE_URL}/me/platform-keys",
            json={"values": {"resend_api_key": "test"}},
            timeout=10
        )
        is_401_or_403 = response.status_code in [401, 403]
        log_test("PUT /api/me/platform-keys with NO token", is_401_or_403, f"Status: {response.status_code}")
        results.append(is_401_or_403)
    except Exception as e:
        log_test("PUT /api/me/platform-keys with NO token", False, f"Error: {str(e)}")
        results.append(False)
    
    return all(results)

def test_6_isolation(admin_token):
    """Test 6: Create second client and verify keys are isolated"""
    print(f"\n{Colors.YELLOW}=== Test 6: Isolation - Create second client ==={Colors.RESET}")
    
    # Create new client as admin
    try:
        start = time.time()
        response = requests.post(
            f"{BASE_URL}/admin/users/create",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "full_name": "Iso Test",
                "email": "isotest@example.com",
                "target_domain": "https://iso.com",
                "industry": "General Website"
            },
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("Create second client (admin)", False, f"Status: {response.status_code}, Response: {response.text[:200]}", f"{elapsed:.2f}s")
            return False
        
        data = response.json()
        temp_password = data.get("temporary_password")
        
        if not temp_password:
            log_test("Create second client (admin)", False, f"No temporary_password in response: {data}")
            return False
        
        log_test("Create second client (admin)", True, f"Status: 200, email=isotest@example.com, temp_password={temp_password}", f"{elapsed:.2f}s")
        
        # Login as new client
        iso_token, iso_user = login("isotest@example.com", temp_password)
        
        if not iso_token:
            log_test("Login as isotest@example.com", False, "Login failed")
            return False
        
        log_test("Login as isotest@example.com", True, f"Login successful, role={iso_user.get('role')}")
        
        # GET /api/me/platform-keys as new client
        response2 = requests.get(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {iso_token}"},
            timeout=10
        )
        
        if response2.status_code != 200:
            log_test("GET /api/me/platform-keys (isotest)", False, f"Status: {response2.status_code}")
            return False
        
        data2 = response2.json()
        categories = data2.get("categories", [])
        
        # Check that all secrets are NOT configured (configured=false)
        all_fields = {}
        for cat in categories:
            for field in cat.get("fields", []):
                all_fields[field["key"]] = field
        
        # Check email/messaging/chat secrets
        secret_keys = ["resend_api_key", "telnyx_api_key", "llm_api_key"]
        all_unconfigured = True
        for key in secret_keys:
            field = all_fields.get(key)
            if field and field.get("configured"):
                log_test("GET /api/me/platform-keys (isotest)", False, f"{key} is configured=True (should be False for new client)")
                all_unconfigured = False
        
        if not all_unconfigured:
            return False
        
        log_test("GET /api/me/platform-keys (isotest)", True, 
                 f"All secrets (resend_api_key, telnyx_api_key, llm_api_key) are configured=False (isolation verified)")
        return True
        
    except Exception as e:
        log_test("Isolation test", False, f"Error: {str(e)}")
        return False

def test_7_demo_keys_intact(demo_token):
    """Test 7: Verify demo client's keys are still intact after isolation test"""
    print(f"\n{Colors.YELLOW}=== Test 7: Demo client keys still intact ==={Colors.RESET}")
    
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/me/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            timeout=10
        )
        elapsed = time.time() - start
        
        if response.status_code != 200:
            log_test("GET /api/me/platform-keys (demo client)", False, f"Status: {response.status_code}", f"{elapsed:.2f}s")
            return False
        
        data = response.json()
        categories = data.get("categories", [])
        
        all_fields = {}
        for cat in categories:
            for field in cat.get("fields", []):
                all_fields[field["key"]] = field
        
        # Check resend_api_key is still configured
        resend = all_fields.get("resend_api_key")
        if not resend or not resend.get("configured"):
            log_test("GET /api/me/platform-keys (demo client)", False, f"resend_api_key lost! configured={resend.get('configured') if resend else 'N/A'}")
            return False
        
        log_test("GET /api/me/platform-keys (demo client)", True, 
                 f"Demo client's keys still intact (resend_api_key configured=True)", 
                 f"{elapsed:.2f}s")
        return True
        
    except Exception as e:
        log_test("Demo client keys intact", False, f"Error: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}Per-Client Keys Endpoints Test{Colors.RESET}")
    print(f"{Colors.BLUE}Testing: GET/PUT /api/me/platform-keys{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}")
    
    # Login as demo client
    print(f"\n{Colors.YELLOW}=== Login as demo client ==={Colors.RESET}")
    demo_token, demo_user = login(DEMO_EMAIL, DEMO_PASSWORD)
    if not demo_token:
        print(f"{Colors.RED}FAILED: Could not login as demo client{Colors.RESET}")
        sys.exit(1)
    log_test("Login as demo@client.com", True, f"Role: {demo_user.get('role')}")
    
    # Login as admin
    print(f"\n{Colors.YELLOW}=== Login as admin ==={Colors.RESET}")
    admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print(f"{Colors.RED}FAILED: Could not login as admin{Colors.RESET}")
        sys.exit(1)
    log_test("Login as admin", True, f"Role: {admin_user.get('role')}")
    
    # Run tests
    results = []
    
    # Test 1: GET initial keys
    result = test_1_get_initial_keys(demo_token)
    if isinstance(result, tuple):
        results.append(result[0])
        initial_data = result[1]
    else:
        results.append(result)
        initial_data = None
    
    # Test 2: PUT keys
    results.append(test_2_put_keys(demo_token))
    
    # Test 3: GET masked keys
    result = test_3_get_masked_keys(demo_token)
    if isinstance(result, tuple):
        results.append(result[0])
        masked_fields = result[1]
    else:
        results.append(result)
        masked_fields = {}
    
    # Test 4: Idempotent masked PUT
    results.append(test_4_idempotent_masked_put(demo_token, masked_fields))
    
    # Test 5: Auth enforcement
    results.append(test_5_auth_enforcement())
    
    # Test 6: Isolation
    results.append(test_6_isolation(admin_token))
    
    # Test 7: Demo keys intact
    results.append(test_7_demo_keys_intact(demo_token))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}Test Summary{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}")
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    print(f"\nTests passed: {passed}/{total}")
    
    if all(results):
        print(f"\n{Colors.GREEN}ALL TESTS PASSED ✓{Colors.RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{Colors.RED}SOME TESTS FAILED{Colors.RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
