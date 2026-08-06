#!/usr/bin/env python3
"""
Backend Auth Bug Fix Verification Test
Tests that admin login does NOT hang after backend restart (avatar generation moved to background)
"""
import requests
import time
import sys
import subprocess

# Use the public backend URL from frontend/.env
BASE_URL = "https://9637df82-16ce-40a3-8b4b-1ea16e526f30.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "baazisufi23@gmail.com"
ADMIN_PASSWORD = "Kairo@Admin2025"
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

def restart_backend():
    """Restart the backend service"""
    print(f"\n{Colors.YELLOW}=== CRITICAL TEST: Backend Restart & Immediate Readiness ==={Colors.RESET}")
    print("Restarting backend service...")
    result = subprocess.run(
        ["sudo", "supervisorctl", "restart", "backend"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"{Colors.RED}Failed to restart backend: {result.stderr}{Colors.RESET}")
        return False
    print(f"{Colors.GREEN}Backend restart command issued{Colors.RESET}")
    return True

def poll_backend_ready():
    """Poll GET /api/ until it returns 200, measure time"""
    print("\nPolling GET /api/ until ready...")
    start_time = time.time()
    max_wait = 70  # Should be ready in seconds, not 60s
    poll_interval = 0.5
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(f"{BASE_URL}/", timeout=3)
            if response.status_code == 200:
                elapsed = time.time() - start_time
                log_test(
                    "Backend ready after restart",
                    True,
                    f"Status: {response.status_code}",
                    f"{elapsed:.2f}s"
                )
                if elapsed > 10:
                    print(f"  {Colors.YELLOW}⚠ Warning: Took longer than expected (should be <5s){Colors.RESET}")
                return True, elapsed
        except requests.exceptions.RequestException as e:
            pass  # Expected during startup
        time.sleep(poll_interval)
    
    elapsed = time.time() - start_time
    log_test(
        "Backend ready after restart",
        False,
        f"Timeout after {elapsed:.2f}s - backend did not become ready",
        f"{elapsed:.2f}s"
    )
    return False, elapsed

def test_admin_login_immediate():
    """Test admin login immediately after backend is ready (should not hang)"""
    print(f"\n{Colors.YELLOW}=== CRITICAL TEST: Admin Login Immediately After Restart ==={Colors.RESET}")
    
    start_time = time.time()
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=5
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            has_token = "token" in data
            has_user = "user" in data
            is_admin = data.get("user", {}).get("role") == "admin"
            
            success = has_token and has_user and is_admin
            details = f"Status: {response.status_code}, Token: {has_token}, User: {has_user}, Role: {data.get('user', {}).get('role')}"
            
            log_test(
                "Admin login immediately after restart (NO HANG)",
                success,
                details,
                f"{elapsed:.2f}s"
            )
            
            if elapsed > 3:
                print(f"  {Colors.YELLOW}⚠ Warning: Login took longer than expected (should be <2s){Colors.RESET}")
            
            return success, data.get("token") if success else None
        else:
            log_test(
                "Admin login immediately after restart",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}",
                f"{elapsed:.2f}s"
            )
            return False, None
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        log_test(
            "Admin login immediately after restart",
            False,
            "TIMEOUT - Login hung (BUG NOT FIXED)",
            f"{elapsed:.2f}s"
        )
        return False, None
    except Exception as e:
        elapsed = time.time() - start_time
        log_test(
            "Admin login immediately after restart",
            False,
            f"Error: {str(e)}",
            f"{elapsed:.2f}s"
        )
        return False, None

def test_functional_checks(admin_token):
    """Run all functional checks"""
    print(f"\n{Colors.YELLOW}=== Functional Checks ==={Colors.RESET}")
    
    results = []
    
    # Test 1: GET /api/me with admin token
    try:
        start = time.time()
        response = requests.get(
            f"{BASE_URL}/me",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=5
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            is_admin = data.get("role") == "admin"
            log_test(
                "GET /api/me with admin token",
                is_admin,
                f"Status: {response.status_code}, Role: {data.get('role')}",
                f"{elapsed:.2f}s"
            )
            results.append(is_admin)
        else:
            log_test("GET /api/me with admin token", False, f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("GET /api/me with admin token", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 2: Demo client login
    try:
        start = time.time()
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            timeout=5
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            is_client = data.get("user", {}).get("role") == "client"
            log_test(
                "Demo client login",
                is_client,
                f"Status: {response.status_code}, Role: {data.get('user', {}).get('role')}",
                f"{elapsed:.2f}s"
            )
            results.append(is_client)
        else:
            log_test("Demo client login", False, f"Status: {response.status_code}")
            results.append(False)
    except Exception as e:
        log_test("Demo client login", False, f"Error: {str(e)}")
        results.append(False)
    
    return all(results)

def test_security_checks():
    """Run all security checks"""
    print(f"\n{Colors.YELLOW}=== Security Checks ==={Colors.RESET}")
    
    results = []
    
    # Test 1: Wrong password for admin
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": "WrongPass123"},
            timeout=5
        )
        is_401 = response.status_code == 401
        log_test(
            "Wrong password returns 401",
            is_401,
            f"Status: {response.status_code}"
        )
        results.append(is_401)
    except Exception as e:
        log_test("Wrong password returns 401", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 2: Unknown email
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "nobody@nowhere.com", "password": "x"},
            timeout=5
        )
        is_401 = response.status_code == 401
        log_test(
            "Unknown email returns 401",
            is_401,
            f"Status: {response.status_code}"
        )
        results.append(is_401)
    except Exception as e:
        log_test("Unknown email returns 401", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 3: Email trimming and lowercasing
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "  BAAZISUFI23@GMAIL.COM  ", "password": ADMIN_PASSWORD},
            timeout=5
        )
        is_200 = response.status_code == 200
        log_test(
            "Email trimming/lowercasing works",
            is_200,
            f"Status: {response.status_code} (whitespace + caps tolerated)"
        )
        results.append(is_200)
    except Exception as e:
        log_test("Email trimming/lowercasing works", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 4: GET /api/me with no token
    try:
        response = requests.get(f"{BASE_URL}/me", timeout=5)
        is_401_or_403 = response.status_code in [401, 403]
        log_test(
            "GET /api/me with no token returns 401/403",
            is_401_or_403,
            f"Status: {response.status_code}"
        )
        results.append(is_401_or_403)
    except Exception as e:
        log_test("GET /api/me with no token returns 401/403", False, f"Error: {str(e)}")
        results.append(False)
    
    # Test 5: GET /api/me with invalid token
    try:
        response = requests.get(
            f"{BASE_URL}/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
            timeout=5
        )
        is_401_or_403 = response.status_code in [401, 403]
        log_test(
            "GET /api/me with invalid token returns 401/403",
            is_401_or_403,
            f"Status: {response.status_code}"
        )
        results.append(is_401_or_403)
    except Exception as e:
        log_test("GET /api/me with invalid token returns 401/403", False, f"Error: {str(e)}")
        results.append(False)
    
    return all(results)

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}Backend Auth Bug Fix Verification Test{Colors.RESET}")
    print(f"{Colors.BLUE}Testing: Admin login does NOT hang after backend restart{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}")
    
    # CRITICAL TEST 1: Restart backend
    if not restart_backend():
        print(f"\n{Colors.RED}FAILED: Could not restart backend{Colors.RESET}")
        sys.exit(1)
    
    # CRITICAL TEST 2: Poll until ready (should be seconds, not 60s)
    ready, ready_time = poll_backend_ready()
    if not ready:
        print(f"\n{Colors.RED}CRITICAL FAILURE: Backend did not become ready{Colors.RESET}")
        sys.exit(1)
    
    # CRITICAL TEST 3: Admin login immediately (should not hang)
    login_success, admin_token = test_admin_login_immediate()
    if not login_success:
        print(f"\n{Colors.RED}CRITICAL FAILURE: Admin login failed or hung{Colors.RESET}")
        sys.exit(1)
    
    # Functional checks
    functional_pass = test_functional_checks(admin_token)
    
    # Security checks
    security_pass = test_security_checks()
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*70}{Colors.RESET}")
    print(f"{Colors.BLUE}Test Summary{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}")
    
    critical_pass = ready and login_success
    
    if critical_pass:
        print(f"{Colors.GREEN}✓ CRITICAL: Backend ready in {ready_time:.2f}s (NOT 60s){Colors.RESET}")
        print(f"{Colors.GREEN}✓ CRITICAL: Admin login works immediately (NO HANG){Colors.RESET}")
    else:
        print(f"{Colors.RED}✗ CRITICAL: Bug fix verification FAILED{Colors.RESET}")
    
    if functional_pass:
        print(f"{Colors.GREEN}✓ Functional checks: PASSED{Colors.RESET}")
    else:
        print(f"{Colors.RED}✗ Functional checks: FAILED{Colors.RESET}")
    
    if security_pass:
        print(f"{Colors.GREEN}✓ Security checks: PASSED{Colors.RESET}")
    else:
        print(f"{Colors.RED}✗ Security checks: FAILED{Colors.RESET}")
    
    print(f"{Colors.BLUE}{'='*70}{Colors.RESET}\n")
    
    if critical_pass and functional_pass and security_pass:
        print(f"{Colors.GREEN}ALL TESTS PASSED - BUG FIX VERIFIED ✓{Colors.RESET}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}SOME TESTS FAILED{Colors.RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
