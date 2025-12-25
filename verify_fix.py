#!/usr/bin/env python3
"""
Simulate the exact error scenario from the original issue and verify it's fixed.

Original error:
  AttributeError: 'LinkedInOptimizerService' object has no attribute 'get_best_practices'
  (occurred in: /api/v1/linkedin-optimizer/best-practices)
"""

import sys
sys.path.insert(0, '/workspace')

from fastapi.testclient import TestClient
from main import app

def test_original_error_scenario():
    """
    Reproduce the exact scenario from the error report.
    
    The error occurred when:
    - GET request to /api/v1/linkedin-optimizer/best-practices
    - service.get_best_practices(section=section) was called
    - The method didn't exist, causing AttributeError
    """
    print("="*70)
    print("REPRODUCING ORIGINAL ERROR SCENARIO")
    print("="*70)
    print()
    
    print("Original Error:")
    print("  AttributeError: 'LinkedInOptimizerService' object has no")
    print("  attribute 'get_best_practices'")
    print()
    print("Error Location:")
    print("  GET /api/v1/linkedin-optimizer/best-practices")
    print()
    print("-"*70)
    print()
    
    client = TestClient(app)
    
    # Test 1: The exact request that was failing
    print("Test 1: GET /api/v1/linkedin-optimizer/best-practices")
    print("        (The exact request that caused the AttributeError)")
    print()
    
    try:
        response = client.get("/api/v1/linkedin-optimizer/best-practices")
        
        if response.status_code == 200:
            print("   ✓ SUCCESS: Request completed without AttributeError")
            print(f"   Status Code: {response.status_code}")
            data = response.json()
            print(f"   Response has {len(data.get('sections', []))} sections")
            print()
        else:
            print(f"   ✗ FAILED: Status code {response.status_code}")
            print(f"   Response: {response.json()}")
            return False
            
    except AttributeError as e:
        print(f"   ✗ FAILED: AttributeError still occurs: {e}")
        return False
    except Exception as e:
        print(f"   ✗ FAILED: Unexpected error: {e}")
        return False
    
    # Test 2: With section parameter (as shown in error trace)
    print("Test 2: GET /api/v1/linkedin-optimizer/best-practices?section=headline")
    print("        (With section parameter, as mentioned in error)")
    print()
    
    try:
        response = client.get(
            "/api/v1/linkedin-optimizer/best-practices",
            params={"section": "headline"}
        )
        
        if response.status_code == 200:
            print("   ✓ SUCCESS: Request completed without AttributeError")
            print(f"   Status Code: {response.status_code}")
            data = response.json()
            print(f"   Section: {data.get('section')}")
            print(f"   Has tips: {len(data.get('data', {}).get('tips', []))} tips")
            print()
        else:
            print(f"   ✗ FAILED: Status code {response.status_code}")
            return False
            
    except AttributeError as e:
        print(f"   ✗ FAILED: AttributeError still occurs: {e}")
        return False
    except Exception as e:
        print(f"   ✗ FAILED: Unexpected error: {e}")
        return False
    
    # Test 3: Verify the service method directly
    print("Test 3: Direct method call on LinkedInOptimizerService")
    print("        (Verify the method exists on the service object)")
    print()
    
    try:
        from services.linkedin_optimizer_service import LinkedInOptimizerService
        import asyncio
        
        service = LinkedInOptimizerService()
        
        # This was the line that was failing in the original error:
        # result = await service.get_best_practices(section=section)
        
        async def test_method():
            result = await service.get_best_practices(section=None)
            return result
        
        result = asyncio.run(test_method())
        
        print("   ✓ SUCCESS: service.get_best_practices() exists and works")
        print(f"   Method callable: {callable(service.get_best_practices)}")
        print(f"   Result type: {type(result)}")
        print(f"   Result has data: {'data' in result}")
        print()
        
    except AttributeError as e:
        print(f"   ✗ FAILED: AttributeError: {e}")
        return False
    except Exception as e:
        print(f"   ✗ FAILED: Unexpected error: {e}")
        return False
    
    print("="*70)
    print("VERIFICATION COMPLETE")
    print("="*70)
    print()
    print("✓ The AttributeError has been successfully fixed!")
    print("✓ The endpoint /api/v1/linkedin-optimizer/best-practices works correctly")
    print("✓ The method LinkedInOptimizerService.get_best_practices() exists")
    print("✓ All test scenarios pass without errors")
    print()
    print("="*70)
    
    return True


if __name__ == "__main__":
    success = test_original_error_scenario()
    sys.exit(0 if success else 1)
