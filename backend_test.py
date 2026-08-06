#!/usr/bin/env python3
"""
Backend API tests for Kairo SaaS - 4 NEW feature groups:
1. Centralized Platform Keys
2. Waitlist
3. Public booking calendar
4. Answer Suggestions
"""
import requests
import json
import sys
from datetime import datetime

# Base URL - internal localhost
BASE_URL = "http://localhost:8001/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "baazisufi23@gmail.com"
ADMIN_PASSWORD = "Kairo@Admin2025"
DEMO_EMAIL = "demo@client.com"
DEMO_PASSWORD = "Demo@12345"

# Global state
admin_token = None
demo_token = None
test_results = []

def log(msg):
    print(f"[TEST] {msg}")

def record_result(test_name, passed, status_code=None, details=""):
    result = {
        "test": test_name,
        "passed": passed,
        "status_code": status_code,
        "details": details
    }
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    log(f"{status}: {test_name} (status={status_code}) {details}")

# ============= AUTHENTICATION =============
def test_admin_login():
    """Admin login to get Bearer token"""
    global admin_token
    log("=" * 60)
    log("ADMIN LOGIN")
    log("=" * 60)
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=15)
        
        if resp.status_code != 200:
            record_result("Admin login", False, resp.status_code, f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if "token" not in data:
            record_result("Admin login", False, resp.status_code, "No token in response")
            return False
        
        admin_token = data["token"]
        record_result("Admin login", True, resp.status_code, f"Token: {admin_token[:20]}...")
        return True
    except Exception as e:
        record_result("Admin login", False, None, f"Exception: {str(e)}")
        return False

def test_demo_login():
    """Demo client login to get Bearer token"""
    global demo_token
    log("=" * 60)
    log("DEMO CLIENT LOGIN")
    log("=" * 60)
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": DEMO_EMAIL,
            "password": DEMO_PASSWORD
        }, timeout=15)
        
        if resp.status_code != 200:
            record_result("Demo client login", False, resp.status_code, f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if "token" not in data:
            record_result("Demo client login", False, resp.status_code, "No token in response")
            return False
        
        demo_token = data["token"]
        record_result("Demo client login", True, resp.status_code, f"Token: {demo_token[:20]}...")
        return True
    except Exception as e:
        record_result("Demo client login", False, None, f"Exception: {str(e)}")
        return False

# ============= 1. CENTRALIZED PLATFORM KEYS =============
def test_platform_keys_get():
    """GET /api/admin/platform-keys (admin token) -> 200 with categories array"""
    log("=" * 60)
    log("1. CENTRALIZED PLATFORM KEYS - GET")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/admin/platform-keys", False, resp.status_code, f"Response: {resp.text[:200]}")
            return None
        
        data = resp.json()
        
        # Verify structure
        if "categories" not in data:
            record_result("GET /api/admin/platform-keys", False, resp.status_code, "Missing 'categories' in response")
            return None
        
        categories = data["categories"]
        if not isinstance(categories, list):
            record_result("GET /api/admin/platform-keys", False, resp.status_code, "'categories' is not a list")
            return None
        
        # Verify expected categories exist
        expected_categories = ["email", "calendar", "messaging", "voice", "chat"]
        found_categories = [cat.get("category") for cat in categories]
        
        for exp_cat in expected_categories:
            if exp_cat not in found_categories:
                record_result("GET /api/admin/platform-keys", False, resp.status_code, 
                            f"Missing expected category: {exp_cat}")
                return None
        
        # Verify each category has fields with key/label/secret/configured/value
        for cat in categories:
            if "fields" not in cat:
                record_result("GET /api/admin/platform-keys", False, resp.status_code, 
                            f"Category {cat.get('category')} missing 'fields'")
                return None
            
            for field in cat["fields"]:
                required_keys = ["key", "label", "secret", "configured", "value"]
                for req_key in required_keys:
                    if req_key not in field:
                        record_result("GET /api/admin/platform-keys", False, resp.status_code, 
                                    f"Field missing '{req_key}': {field}")
                        return None
        
        record_result("GET /api/admin/platform-keys", True, resp.status_code, 
                     f"Found {len(categories)} categories with all required fields")
        return data
    except Exception as e:
        record_result("GET /api/admin/platform-keys", False, None, f"Exception: {str(e)}")
        return None

def test_platform_keys_put():
    """PUT /api/admin/platform-keys (admin) with test values"""
    log("=" * 60)
    log("1. CENTRALIZED PLATFORM KEYS - PUT")
    log("=" * 60)
    
    try:
        # Set some test values
        test_values = {
            "resend_api_key": "re_test_ABC12345",
            "sender_email": "hello@example.com",
            "booking_url": "https://www.upwork.com/freelancers/baazi"
        }
        
        resp = requests.put(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"values": test_values}, timeout=15)
        
        if resp.status_code != 200:
            record_result("PUT /api/admin/platform-keys", False, resp.status_code, f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if not data.get("ok"):
            record_result("PUT /api/admin/platform-keys", False, resp.status_code, "Response ok != true")
            return False
        
        if "saved" not in data:
            record_result("PUT /api/admin/platform-keys", False, resp.status_code, "Missing 'saved' field")
            return False
        
        saved_fields = data["saved"]
        record_result("PUT /api/admin/platform-keys", True, resp.status_code, 
                     f"Saved {len(saved_fields)} fields: {saved_fields}")
        return True
    except Exception as e:
        record_result("PUT /api/admin/platform-keys", False, None, f"Exception: {str(e)}")
        return False

def test_platform_keys_get_after_put():
    """GET /api/admin/platform-keys again to verify values were saved"""
    log("=" * 60)
    log("1. CENTRALIZED PLATFORM KEYS - GET AFTER PUT")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        # Find resend_api_key field and verify it's configured and masked
        resend_found = False
        sender_found = False
        booking_found = False
        
        for cat in data.get("categories", []):
            for field in cat.get("fields", []):
                if field["key"] == "resend_api_key":
                    resend_found = True
                    if not field.get("configured"):
                        record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                                    "resend_api_key not configured after PUT")
                        return False
                    if not field.get("value", "").startswith("••••"):
                        record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                                    f"resend_api_key not masked: {field.get('value')}")
                        return False
                
                elif field["key"] == "sender_email":
                    sender_found = True
                    if field.get("value") != "hello@example.com":
                        record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                                    f"sender_email value mismatch: {field.get('value')}")
                        return False
                
                elif field["key"] == "booking_url":
                    booking_found = True
                    if field.get("value") != "https://www.upwork.com/freelancers/baazi":
                        record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                                    f"booking_url value mismatch: {field.get('value')}")
                        return False
        
        if not (resend_found and sender_found and booking_found):
            record_result("GET /api/admin/platform-keys (after PUT)", False, resp.status_code, 
                         f"Missing fields: resend={resend_found}, sender={sender_found}, booking={booking_found}")
            return False
        
        record_result("GET /api/admin/platform-keys (after PUT)", True, resp.status_code, 
                     "All values verified: resend_api_key masked, sender_email and booking_url correct")
        return True
    except Exception as e:
        record_result("GET /api/admin/platform-keys (after PUT)", False, None, f"Exception: {str(e)}")
        return False

def test_platform_keys_masked_value_not_wiped():
    """Confirm re-PUT with masked value does NOT wipe the stored secret"""
    log("=" * 60)
    log("1. CENTRALIZED PLATFORM KEYS - MASKED VALUE PRESERVATION")
    log("=" * 60)
    
    try:
        # First, get current values
        resp = requests.get(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("Platform keys masked value preservation", False, resp.status_code, 
                         "Failed to GET current values")
            return False
        
        data = resp.json()
        masked_resend = None
        
        for cat in data.get("categories", []):
            for field in cat.get("fields", []):
                if field["key"] == "resend_api_key":
                    masked_resend = field.get("value")
                    break
        
        if not masked_resend or not masked_resend.startswith("••••"):
            record_result("Platform keys masked value preservation", False, resp.status_code, 
                         "No masked resend_api_key found")
            return False
        
        # Now PUT with the masked value
        resp2 = requests.put(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"values": {"resend_api_key": masked_resend}}, timeout=15)
        
        if resp2.status_code != 200:
            record_result("Platform keys masked value preservation", False, resp2.status_code, 
                         f"PUT with masked value failed: {resp2.text[:200]}")
            return False
        
        # GET again and verify still configured
        resp3 = requests.get(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp3.status_code != 200:
            record_result("Platform keys masked value preservation", False, resp3.status_code, 
                         "Failed to GET after PUT with masked value")
            return False
        
        data3 = resp3.json()
        still_configured = False
        
        for cat in data3.get("categories", []):
            for field in cat.get("fields", []):
                if field["key"] == "resend_api_key":
                    still_configured = field.get("configured", False)
                    break
        
        if not still_configured:
            record_result("Platform keys masked value preservation", False, resp3.status_code, 
                         "resend_api_key was wiped after PUT with masked value")
            return False
        
        record_result("Platform keys masked value preservation", True, resp3.status_code, 
                     "Masked value preserved correctly")
        return True
    except Exception as e:
        record_result("Platform keys masked value preservation", False, None, f"Exception: {str(e)}")
        return False

def test_platform_keys_non_admin_403():
    """Non-admin (demo token) hitting PUT /api/admin/platform-keys must return 403"""
    log("=" * 60)
    log("1. CENTRALIZED PLATFORM KEYS - NON-ADMIN 403")
    log("=" * 60)
    
    try:
        resp = requests.put(f"{BASE_URL}/admin/platform-keys",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"values": {"sender_email": "hacker@evil.com"}}, timeout=15)
        
        if resp.status_code == 403:
            record_result("PUT /api/admin/platform-keys (non-admin)", True, resp.status_code, 
                         "Correctly returned 403 for non-admin")
            return True
        else:
            record_result("PUT /api/admin/platform-keys (non-admin)", False, resp.status_code, 
                         f"Expected 403, got {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        record_result("PUT /api/admin/platform-keys (non-admin)", False, None, f"Exception: {str(e)}")
        return False

# ============= 2. WAITLIST =============
def test_waitlist_post():
    """POST /api/waitlist (no auth) with valid email"""
    log("=" * 60)
    log("2. WAITLIST - POST")
    log("=" * 60)
    
    try:
        test_email = f"lead{datetime.now().timestamp()}@example.com"
        resp = requests.post(f"{BASE_URL}/waitlist", json={
            "email": test_email,
            "name": "Lead One"
        }, timeout=15)
        
        if resp.status_code != 200:
            record_result("POST /api/waitlist", False, resp.status_code, f"Response: {resp.text[:200]}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            record_result("POST /api/waitlist", False, resp.status_code, "Response ok != true")
            return None
        
        if data.get("already"):
            record_result("POST /api/waitlist", False, resp.status_code, 
                         "New email marked as 'already' on first submission")
            return None
        
        record_result("POST /api/waitlist", True, resp.status_code, f"Added {test_email}")
        return test_email
    except Exception as e:
        record_result("POST /api/waitlist", False, None, f"Exception: {str(e)}")
        return None

def test_waitlist_post_duplicate(email):
    """POST /api/waitlist with same email again -> already:true"""
    log("=" * 60)
    log("2. WAITLIST - POST DUPLICATE")
    log("=" * 60)
    
    if not email:
        record_result("POST /api/waitlist (duplicate)", False, None, "No email from previous test")
        return False
    
    try:
        resp = requests.post(f"{BASE_URL}/waitlist", json={
            "email": email,
            "name": "Lead One Again"
        }, timeout=15)
        
        if resp.status_code != 200:
            record_result("POST /api/waitlist (duplicate)", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if not data.get("ok"):
            record_result("POST /api/waitlist (duplicate)", False, resp.status_code, "Response ok != true")
            return False
        
        if not data.get("already"):
            record_result("POST /api/waitlist (duplicate)", False, resp.status_code, 
                         "Duplicate email not marked as 'already'")
            return False
        
        record_result("POST /api/waitlist (duplicate)", True, resp.status_code, 
                     "Correctly returned already:true")
        return True
    except Exception as e:
        record_result("POST /api/waitlist (duplicate)", False, None, f"Exception: {str(e)}")
        return False

def test_waitlist_post_invalid_email():
    """POST /api/waitlist with invalid email -> 422"""
    log("=" * 60)
    log("2. WAITLIST - POST INVALID EMAIL")
    log("=" * 60)
    
    try:
        resp = requests.post(f"{BASE_URL}/waitlist", json={
            "email": "notanemail",
            "name": "Invalid"
        }, timeout=15)
        
        if resp.status_code == 422:
            record_result("POST /api/waitlist (invalid email)", True, resp.status_code, 
                         "Correctly returned 422 for invalid email")
            return True
        else:
            record_result("POST /api/waitlist (invalid email)", False, resp.status_code, 
                         f"Expected 422, got {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        record_result("POST /api/waitlist (invalid email)", False, None, f"Exception: {str(e)}")
        return False

def test_waitlist_get_admin():
    """GET /api/admin/waitlist (admin) -> list with entries"""
    log("=" * 60)
    log("2. WAITLIST - GET ADMIN")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/waitlist",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/admin/waitlist", False, resp.status_code, f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if "count" not in data or "entries" not in data:
            record_result("GET /api/admin/waitlist", False, resp.status_code, 
                         "Missing 'count' or 'entries' in response")
            return False
        
        if data["count"] < 1:
            record_result("GET /api/admin/waitlist", False, resp.status_code, 
                         "Expected at least 1 entry from previous test")
            return False
        
        record_result("GET /api/admin/waitlist", True, resp.status_code, 
                     f"Found {data['count']} entries")
        return True
    except Exception as e:
        record_result("GET /api/admin/waitlist", False, None, f"Exception: {str(e)}")
        return False

def test_waitlist_get_no_auth():
    """GET /api/admin/waitlist without token -> 401/403"""
    log("=" * 60)
    log("2. WAITLIST - GET NO AUTH")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/waitlist", timeout=15)
        
        if resp.status_code in [401, 403]:
            record_result("GET /api/admin/waitlist (no auth)", True, resp.status_code, 
                         "Correctly returned 401/403 without auth")
            return True
        else:
            record_result("GET /api/admin/waitlist (no auth)", False, resp.status_code, 
                         f"Expected 401/403, got {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        record_result("GET /api/admin/waitlist (no auth)", False, None, f"Exception: {str(e)}")
        return False

# ============= 3. PUBLIC BOOKING CALENDAR =============
def test_kairo_availability():
    """GET /api/public/kairo-availability?days=5 (no auth) -> slots array"""
    log("=" * 60)
    log("3. PUBLIC BOOKING CALENDAR - AVAILABILITY")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/public/kairo-availability?days=5", timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         "Response ok != true")
            return None
        
        if "slots" not in data:
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         "Missing 'slots' in response")
            return None
        
        slots = data["slots"]
        if not isinstance(slots, list):
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         "'slots' is not a list")
            return None
        
        if len(slots) == 0:
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         "slots array is empty")
            return None
        
        # Verify slot structure
        first_slot = slots[0]
        required_keys = ["start_iso", "end_iso", "label"]
        for key in required_keys:
            if key not in first_slot:
                record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                             f"Slot missing '{key}': {first_slot}")
                return None
        
        if "meeting_duration" not in data:
            record_result("GET /api/public/kairo-availability", False, resp.status_code, 
                         "Missing 'meeting_duration' in response")
            return None
        
        record_result("GET /api/public/kairo-availability", True, resp.status_code, 
                     f"Found {len(slots)} slots, meeting_duration={data['meeting_duration']}")
        return first_slot["start_iso"]
    except Exception as e:
        record_result("GET /api/public/kairo-availability", False, None, f"Exception: {str(e)}")
        return None

def test_public_reserve(slot_iso):
    """POST /api/public/reserve (no auth) with valid data"""
    log("=" * 60)
    log("3. PUBLIC BOOKING CALENDAR - RESERVE")
    log("=" * 60)
    
    if not slot_iso:
        record_result("POST /api/public/reserve", False, None, "No slot_iso from previous test")
        return False
    
    try:
        test_email = f"alice{datetime.now().timestamp()}@example.com"
        resp = requests.post(f"{BASE_URL}/public/reserve", json={
            "name": "Alice",
            "email": test_email,
            "slot_iso": slot_iso,
            "slot_label": "picked slot"
        }, timeout=15)
        
        if resp.status_code != 200:
            record_result("POST /api/public/reserve", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if not data.get("ok"):
            record_result("POST /api/public/reserve", False, resp.status_code, "Response ok != true")
            return False
        
        if "reservation" not in data:
            record_result("POST /api/public/reserve", False, resp.status_code, 
                         "Missing 'reservation' in response")
            return False
        
        if "booking_url" not in data:
            record_result("POST /api/public/reserve", False, resp.status_code, 
                         "Missing 'booking_url' in response")
            return False
        
        # Verify booking_url is the one we set earlier
        expected_url = "https://www.upwork.com/freelancers/baazi"
        if data["booking_url"] != expected_url:
            record_result("POST /api/public/reserve", False, resp.status_code, 
                         f"booking_url mismatch: expected {expected_url}, got {data['booking_url']}")
            return False
        
        record_result("POST /api/public/reserve", True, resp.status_code, 
                     f"Reserved slot for {test_email}, booking_url correct")
        return True
    except Exception as e:
        record_result("POST /api/public/reserve", False, None, f"Exception: {str(e)}")
        return False

def test_public_reserve_invalid_email():
    """POST /api/public/reserve with invalid email -> 422"""
    log("=" * 60)
    log("3. PUBLIC BOOKING CALENDAR - RESERVE INVALID EMAIL")
    log("=" * 60)
    
    try:
        resp = requests.post(f"{BASE_URL}/public/reserve", json={
            "name": "Invalid",
            "email": "notanemail",
            "slot_iso": "2026-01-01T10:00:00Z",
            "slot_label": "test"
        }, timeout=15)
        
        if resp.status_code == 422:
            record_result("POST /api/public/reserve (invalid email)", True, resp.status_code, 
                         "Correctly returned 422 for invalid email")
            return True
        else:
            record_result("POST /api/public/reserve (invalid email)", False, resp.status_code, 
                         f"Expected 422, got {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        record_result("POST /api/public/reserve (invalid email)", False, None, f"Exception: {str(e)}")
        return False

def test_admin_reservations():
    """GET /api/admin/reservations (admin) -> list with reservations"""
    log("=" * 60)
    log("3. PUBLIC BOOKING CALENDAR - ADMIN RESERVATIONS")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/admin/reservations",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/admin/reservations", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if "count" not in data or "reservations" not in data:
            record_result("GET /api/admin/reservations", False, resp.status_code, 
                         "Missing 'count' or 'reservations' in response")
            return False
        
        if data["count"] < 1:
            record_result("GET /api/admin/reservations", False, resp.status_code, 
                         "Expected at least 1 reservation from previous test")
            return False
        
        record_result("GET /api/admin/reservations", True, resp.status_code, 
                     f"Found {data['count']} reservations")
        return True
    except Exception as e:
        record_result("GET /api/admin/reservations", False, None, f"Exception: {str(e)}")
        return False

# ============= 4. ANSWER SUGGESTIONS =============
def test_answer_suggestions():
    """GET /api/me/training/suggestions (demo client token) -> 200"""
    log("=" * 60)
    log("4. ANSWER SUGGESTIONS")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/me/training/suggestions",
            headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
        
        if resp.status_code != 200:
            record_result("GET /api/me/training/suggestions", False, resp.status_code, 
                         f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        
        if "suggestions" not in data:
            record_result("GET /api/me/training/suggestions", False, resp.status_code, 
                         "Missing 'suggestions' in response")
            return False
        
        suggestions = data["suggestions"]
        if not isinstance(suggestions, list):
            record_result("GET /api/me/training/suggestions", False, resp.status_code, 
                         "'suggestions' is not a list")
            return False
        
        # Empty list is valid if demo client has no messages
        if len(suggestions) == 0:
            if "message" in data:
                record_result("GET /api/me/training/suggestions", True, resp.status_code, 
                             f"Empty suggestions with message: {data['message']}")
            else:
                record_result("GET /api/me/training/suggestions", True, resp.status_code, 
                             "Empty suggestions (demo client likely has no messages)")
        else:
            # Verify structure of suggestions
            first_sugg = suggestions[0]
            required_keys = ["message_id", "session_id", "question", "original", "suggested"]
            for key in required_keys:
                if key not in first_sugg:
                    record_result("GET /api/me/training/suggestions", False, resp.status_code, 
                                 f"Suggestion missing '{key}': {first_sugg}")
                    return False
            
            record_result("GET /api/me/training/suggestions", True, resp.status_code, 
                         f"Found {len(suggestions)} suggestions")
        
        return True
    except Exception as e:
        record_result("GET /api/me/training/suggestions", False, None, f"Exception: {str(e)}")
        return False

def test_answer_suggestions_no_auth():
    """GET /api/me/training/suggestions without token -> 401/403"""
    log("=" * 60)
    log("4. ANSWER SUGGESTIONS - NO AUTH")
    log("=" * 60)
    
    try:
        resp = requests.get(f"{BASE_URL}/me/training/suggestions", timeout=15)
        
        if resp.status_code in [401, 403]:
            record_result("GET /api/me/training/suggestions (no auth)", True, resp.status_code, 
                         "Correctly returned 401/403 without auth")
            return True
        else:
            record_result("GET /api/me/training/suggestions (no auth)", False, resp.status_code, 
                         f"Expected 401/403, got {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        record_result("GET /api/me/training/suggestions (no auth)", False, None, f"Exception: {str(e)}")
        return False

# ============= MAIN TEST RUNNER =============
def main():
    log("=" * 60)
    log("KAIRO SAAS BACKEND API TESTS - 4 NEW FEATURE GROUPS")
    log("=" * 60)
    log(f"Base URL: {BASE_URL}")
    log(f"Admin: {ADMIN_EMAIL}")
    log(f"Demo: {DEMO_EMAIL}")
    log("")
    
    # Authentication
    if not test_admin_login():
        log("❌ CRITICAL: Admin login failed, cannot continue")
        sys.exit(1)
    
    if not test_demo_login():
        log("❌ CRITICAL: Demo login failed, cannot continue")
        sys.exit(1)
    
    # 1. Centralized Platform Keys
    test_platform_keys_get()
    test_platform_keys_put()
    test_platform_keys_get_after_put()
    test_platform_keys_masked_value_not_wiped()
    test_platform_keys_non_admin_403()
    
    # 2. Waitlist
    waitlist_email = test_waitlist_post()
    test_waitlist_post_duplicate(waitlist_email)
    test_waitlist_post_invalid_email()
    test_waitlist_get_admin()
    test_waitlist_get_no_auth()
    
    # 3. Public Booking Calendar
    slot_iso = test_kairo_availability()
    test_public_reserve(slot_iso)
    test_public_reserve_invalid_email()
    test_admin_reservations()
    
    # 4. Answer Suggestions
    test_answer_suggestions()
    test_answer_suggestions_no_auth()
    
    # Summary
    log("")
    log("=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    log(f"Total tests: {total}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    log("")
    
    if failed > 0:
        log("FAILED TESTS:")
        for r in test_results:
            if not r["passed"]:
                log(f"  ❌ {r['test']} (status={r['status_code']}) - {r['details']}")
        log("")
    
    log("ALL TESTS:")
    for r in test_results:
        status = "✅" if r["passed"] else "❌"
        log(f"  {status} {r['test']} (status={r['status_code']})")
    
    log("")
    log("=" * 60)
    if failed == 0:
        log("✅ ALL TESTS PASSED")
    else:
        log(f"❌ {failed} TEST(S) FAILED")
    log("=" * 60)
    
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
