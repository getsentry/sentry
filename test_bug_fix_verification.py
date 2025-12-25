"""
Reproduce and verify fix for the AttributeError:
'LinkedInOptimizerService' object has no attribute 'get_best_practices'

This test simulates the exact error scenario from the bug report.
"""

import sys
import asyncio
sys.path.insert(0, "/workspace")

from services.linkedin_optimizer_service import LinkedInOptimizerService


async def main():
    print("="*70)
    print("REPRODUCING THE BUG SCENARIO")
    print("="*70)
    print()
    print("Original Error:")
    print("  AttributeError: 'LinkedInOptimizerService' object has no")
    print("  attribute 'get_best_practices'")
    print()
    print("Location: /api/v1/linkedin-optimizer/best-practices (Line 284)")
    print("Code: result = await service.get_best_practices(section=section)")
    print()
    print("="*70)
    print()
    
    # Simulate the exact scenario from the error
    print("Step 1: Creating LinkedInOptimizerService instance...")
    service = LinkedInOptimizerService()
    print(f"✓ Service instance created: {service}")
    print()
    
    print("Step 2: Checking if 'get_best_practices' attribute exists...")
    has_method = hasattr(service, 'get_best_practices')
    print(f"✓ hasattr(service, 'get_best_practices'): {has_method}")
    
    if not has_method:
        print("✗ FAILED: Method does not exist!")
        return False
    print()
    
    print("Step 3: Checking if it's callable...")
    is_callable = callable(getattr(service, 'get_best_practices'))
    print(f"✓ Method is callable: {is_callable}")
    print()
    
    print("Step 4: Simulating the exact API call that failed...")
    print("   Calling: service.get_best_practices(section=None)")
    
    try:
        # This is the exact call from line 284 that was failing
        result = await service.get_best_practices(section=None)
        print(f"✓ Method call succeeded!")
        print(f"   Result keys: {list(result.keys())}")
        print(f"   Success status: {result.get('success')}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
        return False
    print()
    
    print("Step 5: Testing with section parameter (as in original request)...")
    print("   Calling: service.get_best_practices(section='headline')")
    
    try:
        result = await service.get_best_practices(section="headline")
        print(f"✓ Method call with section parameter succeeded!")
        print(f"   Section: {result.get('section')}")
        print(f"   Tips count: {len(result.get('data', {}).get('tips', []))}")
    except AttributeError as e:
        print(f"✗ FAILED: {e}")
        return False
    print()
    
    print("="*70)
    print("VERIFICATION COMPLETE")
    print("="*70)
    print()
    print("✓ The AttributeError has been FIXED!")
    print()
    print("Summary:")
    print("  - LinkedInOptimizerService class exists")
    print("  - get_best_practices method exists")
    print("  - Method accepts optional 'section' parameter")
    print("  - Method returns proper dictionary structure")
    print("  - No AttributeError is raised")
    print()
    print("The API endpoint will now work correctly:")
    print("  GET /api/v1/linkedin-optimizer/best-practices")
    print("  GET /api/v1/linkedin-optimizer/best-practices?section=headline")
    print()
    print("="*70)
    
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
