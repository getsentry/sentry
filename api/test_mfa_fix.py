"""Test to verify the MFA UUID fix."""
import pytest
from uuid import UUID, uuid4
from unittest.mock import Mock, patch
from fastapi import HTTPException

# Import the functions we need to test
import sys
sys.path.insert(0, '/workspace')

from api.routes.mfa import is_valid_uuid, get_auth_logs
from services.two_factor_service import TwoFactorService


def test_is_valid_uuid():
    """Test UUID validation function."""
    # Valid UUIDs
    assert is_valid_uuid("550e8400-e29b-41d4-a716-446655440000") is True
    assert is_valid_uuid(str(uuid4())) is True
    
    # Invalid UUIDs (the problematic case from the error)
    assert is_valid_uuid("user_1766682119.873619") is False
    assert is_valid_uuid("not-a-uuid") is False
    assert is_valid_uuid("123") is False
    assert is_valid_uuid("") is False
    
    # Edge cases
    assert is_valid_uuid(None) is False


def test_service_accepts_both_uuid_and_string():
    """Test that TwoFactorService accepts both UUID and string user IDs."""
    service = TwoFactorService()
    
    # Test with UUID
    uuid_id = uuid4()
    logs1 = service.get_auth_logs(user_id=uuid_id)
    assert isinstance(logs1, list)
    
    # Test with non-UUID string (the problematic case)
    string_id = "user_1766682119.873619"
    logs2 = service.get_auth_logs(user_id=string_id)
    assert isinstance(logs2, list)
    
    # Test with valid UUID string
    uuid_string = "550e8400-e29b-41d4-a716-446655440000"
    logs3 = service.get_auth_logs(user_id=uuid_string)
    assert isinstance(logs3, list)


async def test_get_auth_logs_with_non_uuid():
    """Test the endpoint with a non-UUID user ID (the original bug scenario)."""
    # Mock the dependencies
    mock_current_user = {
        "id": "user_1766682119.873619",  # Non-UUID ID that caused the error
        "email": "test@example.com",
        "is_active": True,
    }
    
    mock_service = Mock(spec=TwoFactorService)
    mock_service.get_auth_logs.return_value = []
    
    # Call the endpoint function
    result = await get_auth_logs(
        event_type=None,
        suspicious_only=False,
        limit=50,
        offset=0,
        current_user=mock_current_user,
        service=mock_service,
    )
    
    # Verify the function completed successfully (no ValueError)
    assert result is not None
    assert "logs" in result
    assert "pagination" in result
    assert result["user_id"] == "user_1766682119.873619"
    
    # Verify service was called with the string ID (not converted to UUID)
    mock_service.get_auth_logs.assert_called_once()
    call_args = mock_service.get_auth_logs.call_args
    assert call_args.kwargs["user_id"] == "user_1766682119.873619"


async def test_get_auth_logs_with_valid_uuid():
    """Test the endpoint with a valid UUID user ID."""
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
    
    # Verify service was called with a UUID object
    call_args = mock_service.get_auth_logs.call_args
    user_id_arg = call_args.kwargs["user_id"]
    assert isinstance(user_id_arg, UUID)
    assert str(user_id_arg) == valid_uuid


async def test_get_auth_logs_with_invalid_event_type():
    """Test that invalid event types raise proper errors."""
    mock_current_user = {
        "id": "user_123",
        "email": "test@example.com",
        "is_active": True,
    }
    
    mock_service = Mock(spec=TwoFactorService)
    
    # Should raise HTTPException for invalid event type
    with pytest.raises(HTTPException) as exc_info:
        await get_auth_logs(
            event_type="invalid_type",
            suspicious_only=False,
            limit=50,
            offset=0,
            current_user=mock_current_user,
            service=mock_service,
        )
    
    assert exc_info.value.status_code == 400
    assert "Invalid event type" in exc_info.value.detail


if __name__ == "__main__":
    print("Running MFA UUID fix tests...")
    print("=" * 60)
    
    # Test UUID validation
    print("\n1. Testing UUID validation function...")
    test_is_valid_uuid()
    print("   ✓ UUID validation works correctly")
    
    # Test service layer
    print("\n2. Testing service layer accepts both UUID and string...")
    test_service_accepts_both_uuid_and_string()
    print("   ✓ Service layer handles both types")
    
    # Test endpoint with non-UUID (the bug scenario)
    print("\n3. Testing endpoint with non-UUID user ID (bug scenario)...")
    import asyncio
    asyncio.run(test_get_auth_logs_with_non_uuid())
    print("   ✓ Endpoint handles non-UUID user IDs correctly")
    
    # Test endpoint with valid UUID
    print("\n4. Testing endpoint with valid UUID user ID...")
    asyncio.run(test_get_auth_logs_with_valid_uuid())
    print("   ✓ Endpoint still handles valid UUIDs correctly")
    
    # Test error handling
    print("\n5. Testing error handling...")
    asyncio.run(test_get_auth_logs_with_invalid_event_type())
    print("   ✓ Error handling works correctly")
    
    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("\nThe fix successfully handles:")
    print("  • Non-UUID user IDs (like 'user_1766682119.873619')")
    print("  • Valid UUID user IDs")
    print("  • Proper error messages for invalid inputs")
