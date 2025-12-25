#!/usr/bin/env python3
"""Comprehensive integration test to verify the entire fix."""
import sys
sys.path.insert(0, '/workspace')

import asyncio
from services.recruiter_crm_service import RecruiterCRMService


async def test_integration():
    """Run integration tests."""
    print("="*70)
    print("COMPREHENSIVE INTEGRATION TEST")
    print("="*70)
    
    # Test 1: Service instantiation
    print("\n[1/6] Testing service instantiation...")
    try:
        service = RecruiterCRMService()
        print("    ✓ Service instantiated successfully")
    except Exception as e:
        print(f"    ✗ Failed to instantiate service: {e}")
        return False
    
    # Test 2: Method existence
    print("\n[2/6] Checking method existence...")
    if hasattr(service, 'get_pending_follow_ups'):
        print("    ✓ Method 'get_pending_follow_ups' exists")
    else:
        print("    ✗ Method 'get_pending_follow_ups' not found")
        return False
    
    # Test 3: Method is callable
    print("\n[3/6] Verifying method is callable...")
    if callable(getattr(service, 'get_pending_follow_ups')):
        print("    ✓ Method is callable")
    else:
        print("    ✗ Method is not callable")
        return False
    
    # Test 4: Call without parameters
    print("\n[4/6] Testing method call without parameters...")
    try:
        result = await service.get_pending_follow_ups()
        assert isinstance(result, dict), "Result should be a dictionary"
        assert 'follow_ups' in result, "Result should contain 'follow_ups'"
        assert 'total' in result, "Result should contain 'total'"
        assert 'filters' in result, "Result should contain 'filters'"
        print(f"    ✓ Method executed successfully")
        print(f"      Response: {result}")
    except Exception as e:
        print(f"    ✗ Method call failed: {e}")
        return False
    
    # Test 5: Call with priority parameter
    print("\n[5/6] Testing method call with priority parameter...")
    try:
        result = await service.get_pending_follow_ups(priority="high")
        assert result['filters']['priority'] == 'high', "Priority filter not applied"
        print(f"    ✓ Priority filter works correctly")
        print(f"      Filters: {result['filters']}")
    except Exception as e:
        print(f"    ✗ Priority filter failed: {e}")
        return False
    
    # Test 6: Call with both parameters
    print("\n[6/6] Testing method call with both parameters...")
    try:
        result = await service.get_pending_follow_ups(
            priority="medium",
            due_before="2024-12-31"
        )
        assert result['filters']['priority'] == 'medium', "Priority filter not applied"
        assert result['filters']['due_before'] == '2024-12-31', "Due before filter not applied"
        print(f"    ✓ Both filters work correctly")
        print(f"      Filters: {result['filters']}")
    except Exception as e:
        print(f"    ✗ Both filters failed: {e}")
        return False
    
    return True


async def test_api_imports():
    """Test that API modules can be imported."""
    print("\n" + "="*70)
    print("TESTING API MODULE IMPORTS")
    print("="*70)
    
    try:
        print("\n[1/2] Importing API routes...")
        from api.routes import recruiter_crm
        print("    ✓ API routes imported successfully")
        
        print("\n[2/2] Checking router exists...")
        assert hasattr(recruiter_crm, 'router'), "Router not found"
        print("    ✓ Router exists in recruiter_crm module")
        
        return True
    except Exception as e:
        print(f"    ✗ Import failed: {e}")
        return False


async def test_middleware_imports():
    """Test that middleware modules can be imported."""
    print("\n" + "="*70)
    print("TESTING MIDDLEWARE MODULE IMPORTS")
    print("="*70)
    
    try:
        print("\n[1/2] Importing security middleware...")
        from middleware.security import SecurityHeadersMiddleware, RateLimitMiddleware
        print("    ✓ Security middleware imported successfully")
        
        print("\n[2/2] Importing logging middleware...")
        from middleware.logging import RequestLoggingMiddleware
        print("    ✓ Logging middleware imported successfully")
        
        return True
    except Exception as e:
        print(f"    ✗ Import failed: {e}")
        return False


async def main():
    """Run all tests."""
    print("\n")
    print("╔" + "═"*68 + "╗")
    print("║" + " "*15 + "RECRUITER CRM FIX VERIFICATION" + " "*23 + "║")
    print("╚" + "═"*68 + "╝")
    
    # Run all test suites
    service_test = await test_integration()
    api_test = await test_api_imports()
    middleware_test = await test_middleware_imports()
    
    # Final summary
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)
    print(f"Service Tests:    {'✓ PASS' if service_test else '✗ FAIL'}")
    print(f"API Tests:        {'✓ PASS' if api_test else '✗ FAIL'}")
    print(f"Middleware Tests: {'✓ PASS' if middleware_test else '✗ FAIL'}")
    print("="*70)
    
    if service_test and api_test and middleware_test:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        print("\nThe AttributeError has been successfully fixed!")
        print("The RecruiterCRMService now has the 'get_pending_follow_ups' method.")
        print("\nThe following issues have been resolved:")
        print("  ✓ Missing method 'get_pending_follow_ups' implemented")
        print("  ✓ Proper parameter handling (priority, due_before)")
        print("  ✓ Correct response structure")
        print("  ✓ All supporting infrastructure in place")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        print("Please review the output above for details.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
