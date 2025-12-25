"""
Tests for MFA routes.
"""
import pytest
from uuid import uuid4
from api.routes.mfa import get_auth_logs, is_valid_uuid
from services.two_factor_service import TwoFactorService


class MockService:
    """Mock TwoFactorService for testing."""
    
    def get_auth_logs(self, user_id, **kwargs):
        """Mock get_auth_logs method."""
        return []


class TestIsValidUUID:
    """Tests for UUID validation helper."""
    
    def test_valid_uuid(self):
        """Test that valid UUIDs are recognized."""
        valid_uuid = str(uuid4())
        assert is_valid_uuid(valid_uuid) is True
        
    def test_invalid_uuid_non_hex(self):
        """Test that non-UUID strings are rejected."""
        invalid_uuid = "user_1766682119.873619"
        assert is_valid_uuid(invalid_uuid) is False
        
    def test_invalid_uuid_wrong_format(self):
        """Test that incorrectly formatted strings are rejected."""
        assert is_valid_uuid("not-a-uuid") is False
        assert is_valid_uuid("12345") is False
        assert is_valid_uuid("") is False
        
    def test_none_uuid(self):
        """Test that None is handled gracefully."""
        assert is_valid_uuid(None) is False


class TestGetAuthLogsEndpoint:
    """Tests for the get_auth_logs endpoint."""
    
    @pytest.mark.asyncio
    async def test_with_valid_uuid(self):
        """Test endpoint with a valid UUID user ID."""
        user_id = str(uuid4())
        current_user = {
            "id": user_id,
            "email": "test@example.com",
            "is_active": True,
        }
        service = MockService()
        
        # Should not raise an error
        result = await get_auth_logs(
            current_user=current_user,
            event_type=None,
            suspicious_only=False,
            limit=50,
            offset=0,
            service=service,
        )
        
        assert result == []
        
    @pytest.mark.asyncio
    async def test_with_non_uuid_string(self):
        """Test endpoint with a non-UUID user ID (the bug scenario)."""
        # This is the exact user ID from the error report
        current_user = {
            "id": "user_1766682119.873619",
            "email": "test@example.com",
            "is_active": True,
        }
        service = MockService()
        
        # Before the fix, this would raise:
        # ValueError: badly formed hexadecimal UUID string
        # After the fix, it should work fine
        result = await get_auth_logs(
            current_user=current_user,
            event_type=None,
            suspicious_only=False,
            limit=50,
            offset=0,
            service=service,
        )
        
        assert result == []
        
    @pytest.mark.asyncio
    async def test_with_event_type_filter(self):
        """Test endpoint with event type filtering."""
        current_user = {
            "id": "user_1766682119.873619",
            "email": "test@example.com",
            "is_active": True,
        }
        service = MockService()
        
        result = await get_auth_logs(
            current_user=current_user,
            event_type="login",
            suspicious_only=False,
            limit=50,
            offset=0,
            service=service,
        )
        
        assert result == []
        
    @pytest.mark.asyncio
    async def test_with_pagination(self):
        """Test endpoint with pagination parameters."""
        current_user = {
            "id": "user_test_123",
            "email": "test@example.com",
            "is_active": True,
        }
        service = MockService()
        
        result = await get_auth_logs(
            current_user=current_user,
            event_type=None,
            suspicious_only=False,
            limit=25,
            offset=10,
            service=service,
        )
        
        assert result == []
