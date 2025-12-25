"""Simple test to verify the MFA UUID fix (no external dependencies)."""
from uuid import UUID, uuid4
from unittest.mock import Mock
import sys
import asyncio

sys.path.insert(0, '/workspace')

from api.routes.mfa import is_valid_uuid, get_auth_logs
from services.two_factor_service import TwoFactorService


def test_is_valid_uuid():
    """Test UUID validation function."""
    print("Testing UUID validation...")
    
    # Valid UUIDs
    assert is_valid_uuid("550e8400-e29b-41d4-a716-446655440000") is True
    assert is_valid_uuid(str(uuid4())) is True
    print("  ✓ Valid UUIDs recognized correctly")
    
    # Invalid UUIDs (the problematic case from the error)
    assert is_valid_uuid("user_1766682119.873619") is False
    assert is_valid_uuid("not-a-uuid") is False
    assert is_valid_uuid("123") is False
    assert is_valid_uuid("") is False
    print("  ✓ Invalid UUIDs rejected correctly")
    
    # Edge cases
    assert is_valid_uuid(None) is False
    print("  ✓ Edge cases handled correctly")


def test_service_accepts_both_types():
    """Test that TwoFactorService accepts both UUID and string user IDs."""
    print("\nTesting service layer...")
    service = TwoFactorService()
    
    # Test with UUID
    uuid_id = uuid4()
    logs1 = service.get_auth_logs(user_id=uuid_id)
    assert isinstance(logs1, list)
    print("  ✓ Service accepts UUID objects")
    
    # Test with non-UUID string (the problematic case)
    string_id = "user_1766682119.873619"
    logs2 = service.get_auth_logs(user_id=string_id)
    assert isinstance(logs2, list)
    print("  ✓ Service accepts non-UUID strings")
    
    # Test with valid UUID string
    uuid_string = "550e8400-e29b-41d4-a716-446655440000"
    logs3 = service.get_auth_logs(user_id=uuid_string)
    assert isinstance(logs3, list)
    print("  ✓ Service accepts UUID strings")


async def test_endpoint_with_non_uuid():
    """Test the endpoint with a non-UUID user ID (the original bug scenario)."""
    print("\nTesting endpoint with non-UUID user ID (bug scenario)...")
    
    # This is the exact user object that caused the original error
    mock_current_user = {
        "id": "user_1766682119.873619",
        "email": "test@example.com",
        "is_active": True,
    }
    
    mock_service = Mock(spec=TwoFactorService)
    mock_service.get_auth_logs.return_value = []
    
    try:
        result = await get_auth_logs(
            event_type=None,
            suspicious_only=False,
            limit=50,
            offset=0,
            current_user=mock_current_user,
            service=mock_service,
        )
        
        assert result is not None
        assert "logs" in result
        assert "pagination" in result
        assert result["user_id"] == "user_1766682119.873619"
        print("  ✓ Endpoint handles non-UUID user IDs without error")
        
        # Verify service was called with the string ID
        mock_service.get_auth_logs.assert_called_once()
        call_args = mock_service.get_auth_logs.call_args
        assert call_args.kwargs["user_id"] == "user_1766682119.873619"
        print("  ✓ Service called with correct string ID")
        
    except ValueError as e:
        if "badly formed hexadecimal UUID string" in str(e):
            print("  ✗ FAILED: Still getting UUID parsing error!")
            raise
        raise


async def test_endpoint_with_valid_uuid():
    """Test the endpoint with a valid UUID user ID."""
    print("\nTesting endpoint with valid UUID user ID...")
    
    valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
    
    mock_current_user = {
        "id": valid_uuid,
        "email": "test@example.com",
        "is_active": True,
    }
    
    mock_service = Mock(spec=TwoFactorService)
    mock_service.get_auth_logs.return_value = []
    
    result = await get_auth_logs(
        event_type=None,
        suspicious_only=False,
        limit=50,
        offset=0,
        current_user=mock_current_user,
        service=mock_service,
    )
    
    assert result is not None
    assert "logs" in result
    print("  ✓ Endpoint handles valid UUID user IDs correctly")
    
    # Verify service was called with a UUID object
    call_args = mock_service.get_auth_logs.call_args
    user_id_arg = call_args.kwargs["user_id"]
    assert isinstance(user_id_arg, UUID)
    assert str(user_id_arg) == valid_uuid
    print("  ✓ Valid UUID converted to UUID object")


def main():
    """Run all tests."""
    print("=" * 70)
    print("MFA UUID FIX - Test Suite")
    print("=" * 70)
    print("\nThis test verifies the fix for:")
    print("  ValueError: badly formed hexadecimal UUID string")
    print("  (occurred in: /api/v1/auth/mfa/logs)")
    print()
    
    try:
        # Run synchronous tests
        test_is_valid_uuid()
        test_service_accepts_both_types()
        
        # Run async tests
        asyncio.run(test_endpoint_with_non_uuid())
        asyncio.run(test_endpoint_with_valid_uuid())
        
        print("\n" + "=" * 70)
        print("✓ ALL TESTS PASSED!")
        print("=" * 70)
        print("\nThe fix successfully handles:")
        print("  • Non-UUID user IDs (like 'user_1766682119.873619')")
        print("  • Valid UUID user IDs")
        print("  • Graceful validation before UUID conversion")
        print("\nThe original error will no longer occur.")
        
        return 0
        
    except Exception as e:
        print("\n" + "=" * 70)
        print("✗ TEST FAILED!")
        print("=" * 70)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
