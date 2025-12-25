"""Standalone verification script for RecruiterCRMService."""
import asyncio
import sys
import os

# Add workspace to path
sys.path.insert(0, '/workspace')

from services.recruiter_crm_service import RecruiterCRMService


async def main():
    """Run verification tests."""
    print("=" * 60)
    print("RecruiterCRMService Verification")
    print("=" * 60)
    
    service = RecruiterCRMService()
    
    # Test 1: Verify the service has the list_recruiters method
    print("\n[Test 1] Checking if list_recruiters method exists...")
    if hasattr(service, 'list_recruiters'):
        print("✓ list_recruiters method exists")
    else:
        print("✗ list_recruiters method NOT FOUND")
        return False
    
    # Test 2: Call list_recruiters with no parameters
    print("\n[Test 2] Calling list_recruiters() with no parameters...")
    try:
        result = await service.list_recruiters()
        print(f"✓ Success! Result: {result}")
        assert "recruiters" in result
        assert "total" in result
        assert "limit" in result
        assert "offset" in result
        assert result["limit"] == 50
        assert result["offset"] == 0
        print("✓ All assertions passed")
    except AttributeError as e:
        print(f"✗ AttributeError: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 3: Call list_recruiters with all parameters
    print("\n[Test 3] Calling list_recruiters() with all parameters...")
    try:
        result = await service.list_recruiters(
            status="active",
            recruiter_type="external",
            company="TechCorp",
            specialization="Software Engineering",
            limit=10,
            offset=5
        )
        print(f"✓ Success! Result: {result}")
        assert result["limit"] == 10
        assert result["offset"] == 5
        assert result["filters"]["status"] == "active"
        assert result["filters"]["recruiter_type"] == "external"
        assert result["filters"]["company"] == "TechCorp"
        assert result["filters"]["specialization"] == "Software Engineering"
        print("✓ All assertions passed")
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    
    # Test 4: Verify other methods exist
    print("\n[Test 4] Checking other methods...")
    methods = ['get_recruiter', 'create_recruiter', 'update_recruiter', 'delete_recruiter']
    for method_name in methods:
        if hasattr(service, method_name):
            print(f"✓ {method_name} method exists")
        else:
            print(f"✗ {method_name} method NOT FOUND")
    
    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
