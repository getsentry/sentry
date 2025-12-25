"""
Test suite for Recruiter CRM functionality.

This test verifies that the AttributeError bug has been fixed.
The bug was: 'RecruiterCRMService' object has no attribute 'list_recruiters'
"""
import sys
import asyncio
from typing import Dict, Any

# Add workspace to path
sys.path.insert(0, '/workspace')

from services.recruiter_crm_service import RecruiterCRMService


class TestRecruiterCRMService:
    """Test cases for RecruiterCRMService."""

    @staticmethod
    async def test_method_exists() -> bool:
        """Verify the list_recruiters method exists."""
        service = RecruiterCRMService()
        assert hasattr(service, 'list_recruiters'), \
            "RecruiterCRMService must have 'list_recruiters' method"
        assert callable(getattr(service, 'list_recruiters')), \
            "'list_recruiters' must be callable"
        return True

    @staticmethod
    async def test_basic_call() -> bool:
        """Test calling the method with no parameters."""
        service = RecruiterCRMService()
        result = await service.list_recruiters()
        
        assert isinstance(result, dict), "Result must be a dictionary"
        assert "recruiters" in result, "Result must contain 'recruiters'"
        assert "total" in result, "Result must contain 'total'"
        assert "limit" in result, "Result must contain 'limit'"
        assert "offset" in result, "Result must contain 'offset'"
        
        return True

    @staticmethod
    async def test_with_all_parameters() -> bool:
        """Test calling with all parameters as in the original error."""
        service = RecruiterCRMService()
        
        # These are the exact parameters from the error trace
        result = await service.list_recruiters(
            status=None,
            recruiter_type=None,
            company=None,
            specialization=None,
            limit=50,
            offset=0
        )
        
        assert result["limit"] == 50, "Limit should be 50"
        assert result["offset"] == 0, "Offset should be 0"
        
        return True

    @staticmethod
    async def test_with_filters() -> bool:
        """Test calling with various filter parameters."""
        service = RecruiterCRMService()
        
        result = await service.list_recruiters(
            status="active",
            recruiter_type="internal",
            company="Test Company",
            specialization="Technology",
            limit=100,
            offset=25
        )
        
        assert result["limit"] == 100, "Limit should be 100"
        assert result["offset"] == 25, "Offset should be 25"
        assert "filters" in result, "Result should contain filters"
        assert result["filters"]["status"] == "active"
        assert result["filters"]["recruiter_type"] == "internal"
        assert result["filters"]["company"] == "Test Company"
        assert result["filters"]["specialization"] == "Technology"
        
        return True

    @staticmethod
    async def test_return_structure() -> bool:
        """Verify the complete return structure."""
        service = RecruiterCRMService()
        result = await service.list_recruiters()
        
        # Check all required fields exist
        required_fields = ["recruiters", "total", "limit", "offset"]
        for field in required_fields:
            assert field in result, f"Result must contain '{field}' field"
        
        # Check types
        assert isinstance(result["recruiters"], list), "'recruiters' must be a list"
        assert isinstance(result["total"], int), "'total' must be an integer"
        assert isinstance(result["limit"], int), "'limit' must be an integer"
        assert isinstance(result["offset"], int), "'offset' must be an integer"
        
        return True


async def run_all_tests():
    """Run all test cases."""
    test_cases = [
        ("Method exists", TestRecruiterCRMService.test_method_exists),
        ("Basic call", TestRecruiterCRMService.test_basic_call),
        ("With all parameters", TestRecruiterCRMService.test_with_all_parameters),
        ("With filters", TestRecruiterCRMService.test_with_filters),
        ("Return structure", TestRecruiterCRMService.test_return_structure),
    ]
    
    print("=" * 70)
    print("Recruiter CRM Service Test Suite")
    print("=" * 70)
    print()
    
    passed = 0
    failed = 0
    
    for test_name, test_func in test_cases:
        try:
            await test_func()
            print(f"✅ PASS: {test_name}")
            passed += 1
        except AssertionError as e:
            print(f"❌ FAIL: {test_name}")
            print(f"   Error: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {test_name}")
            print(f"   Unexpected error: {e}")
            failed += 1
    
    print()
    print("=" * 70)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 70)
    
    if failed == 0:
        print()
        print("🎉 All tests passed!")
        print()
        print("The AttributeError has been successfully fixed.")
        print("RecruiterCRMService now has a working 'list_recruiters' method.")
        return 0
    else:
        print()
        print("⚠️  Some tests failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_all_tests())
    sys.exit(exit_code)
