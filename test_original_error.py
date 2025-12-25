"""Test to verify the original AttributeError is fixed."""
import sys
import asyncio

sys.path.insert(0, '/workspace')

from services.recruiter_crm_service import RecruiterCRMService


async def test_original_error_is_fixed():
    """
    This test reproduces the original error scenario from the bug report:
    
    Original Error:
        AttributeError: 'RecruiterCRMService' object has no attribute 'list_recruiters'
        (occurred in: /api/v1/recruiter-crm/recruiters)
    
    The error occurred when trying to call:
        result = await service.list_recruiters(
            status=status.value if status else None,
            recruiter_type=recruiter_type.value if recruiter_type else None,
            company=company,
            specialization=specialization,
            limit=limit,
            offset=offset
        )
    """
    print("=" * 70)
    print("REPRODUCING ORIGINAL ERROR SCENARIO")
    print("=" * 70)
    print()
    
    # Create service instance (this is what get_service() returns)
    service = RecruiterCRMService()
    
    print(f"✓ Service instance created: {service}")
    print(f"✓ Service type: {type(service)}")
    print()
    
    # Check if the method exists (this would have failed before)
    print("Checking if 'list_recruiters' attribute exists...")
    try:
        has_method = hasattr(service, 'list_recruiters')
        if has_method:
            print(f"✓ SUCCESS: 'list_recruiters' method exists!")
        else:
            print(f"✗ FAILED: 'list_recruiters' method NOT FOUND!")
            return False
    except Exception as e:
        print(f"✗ ERROR checking attribute: {e}")
        return False
    
    print()
    print("Attempting to call list_recruiters() with the exact parameters from the error...")
    print("Parameters: status=None, recruiter_type=None, company=None,")
    print("           specialization=None, limit=50, offset=0")
    print()
    
    # Try to call the method (this is where the AttributeError occurred)
    try:
        result = await service.list_recruiters(
            status=None,  # status.value if status else None
            recruiter_type=None,  # recruiter_type.value if recruiter_type else None
            company=None,
            specialization=None,
            limit=50,
            offset=0
        )
        
        print("✓ SUCCESS: Method call completed without AttributeError!")
        print()
        print("Result structure:")
        print(f"  - recruiters: {result.get('recruiters')} (type: {type(result.get('recruiters'))})")
        print(f"  - total: {result.get('total')}")
        print(f"  - limit: {result.get('limit')}")
        print(f"  - offset: {result.get('offset')}")
        print(f"  - filters: {result.get('filters')}")
        print()
        
        # Verify response structure
        assert 'recruiters' in result, "Missing 'recruiters' in response"
        assert 'total' in result, "Missing 'total' in response"
        assert 'limit' in result, "Missing 'limit' in response"
        assert 'offset' in result, "Missing 'offset' in response"
        assert result['limit'] == 50, f"Expected limit=50, got {result['limit']}"
        assert result['offset'] == 0, f"Expected offset=0, got {result['offset']}"
        
        print("✓ All response structure validations passed!")
        print()
        
    except AttributeError as e:
        print(f"✗ FAILED: AttributeError still occurs!")
        print(f"  Error: {e}")
        print()
        return False
    except Exception as e:
        print(f"✗ FAILED: Unexpected error occurred!")
        print(f"  Error: {e}")
        print()
        return False
    
    # Test with actual filter values (as would be passed from the API)
    print("Testing with filter values (status='active', recruiter_type='external')...")
    try:
        result = await service.list_recruiters(
            status='active',
            recruiter_type='external',
            company='TechCorp',
            specialization='Software Engineering',
            limit=10,
            offset=5
        )
        print("✓ SUCCESS: Method call with filters completed!")
        print(f"  Filters applied: {result.get('filters')}")
        print()
    except Exception as e:
        print(f"✗ FAILED: Error with filters!")
        print(f"  Error: {e}")
        return False
    
    print("=" * 70)
    print("ORIGINAL BUG IS FIXED! ✓")
    print("=" * 70)
    print()
    print("Summary:")
    print("  • RecruiterCRMService class exists ✓")
    print("  • list_recruiters method exists ✓")
    print("  • Method accepts all required parameters ✓")
    print("  • Method returns correct response structure ✓")
    print("  • No AttributeError raised ✓")
    print()
    
    return True


if __name__ == "__main__":
    success = asyncio.run(test_original_error_is_fixed())
    sys.exit(0 if success else 1)
