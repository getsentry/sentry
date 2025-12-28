"""Tests for UUID utility functions."""
import uuid
import pytest
from uuid import UUID

from api.utils import (
    ensure_uuid,
    uuid_to_str,
    is_valid_uuid,
    generate_uuid,
    generate_uuid_str,
    UUIDConverter,
    NULL_UUID,
    NULL_UUID_STR
)


class TestEnsureUUID:
    """Tests for ensure_uuid function."""
    
    def test_ensure_uuid_with_string(self):
        """Test converting string to UUID."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        result = ensure_uuid(uuid_str)
        
        assert isinstance(result, UUID)
        assert str(result) == uuid_str
    
    def test_ensure_uuid_with_uuid_object(self):
        """Test passing UUID object returns same object."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        result = ensure_uuid(uuid_obj)
        
        assert result == uuid_obj
        assert isinstance(result, UUID)
    
    def test_ensure_uuid_with_none(self):
        """Test None returns None."""
        result = ensure_uuid(None)
        assert result is None
    
    def test_ensure_uuid_with_invalid_string(self):
        """Test invalid UUID string raises ValueError."""
        with pytest.raises(ValueError, match="Invalid UUID string"):
            ensure_uuid("not-a-uuid")
    
    def test_ensure_uuid_with_invalid_type(self):
        """Test invalid type raises TypeError."""
        with pytest.raises(TypeError, match="Expected str, UUID, or None"):
            ensure_uuid(123)


class TestUUIDToStr:
    """Tests for uuid_to_str function."""
    
    def test_uuid_to_str_with_uuid(self):
        """Test converting UUID to string."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        result = uuid_to_str(uuid_obj)
        
        assert isinstance(result, str)
        assert result == "00000000-0000-0000-0000-000000000001"
    
    def test_uuid_to_str_with_string(self):
        """Test string UUID returns same string."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        result = uuid_to_str(uuid_str)
        
        assert result == uuid_str
    
    def test_uuid_to_str_with_none(self):
        """Test None returns None."""
        result = uuid_to_str(None)
        assert result is None
    
    def test_uuid_to_str_with_invalid_string(self):
        """Test invalid UUID string raises ValueError."""
        with pytest.raises(ValueError, match="Invalid UUID string"):
            uuid_to_str("not-a-uuid")
    
    def test_uuid_to_str_with_invalid_type(self):
        """Test invalid type raises TypeError."""
        with pytest.raises(TypeError, match="Expected str, UUID, or None"):
            uuid_to_str(123)


class TestIsValidUUID:
    """Tests for is_valid_uuid function."""
    
    def test_is_valid_uuid_with_valid_string(self):
        """Test valid UUID string returns True."""
        assert is_valid_uuid("00000000-0000-0000-0000-000000000001") is True
    
    def test_is_valid_uuid_with_uuid_object(self):
        """Test UUID object returns True."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        assert is_valid_uuid(uuid_obj) is True
    
    def test_is_valid_uuid_with_invalid_string(self):
        """Test invalid UUID string returns False."""
        assert is_valid_uuid("not-a-uuid") is False
    
    def test_is_valid_uuid_with_none(self):
        """Test None returns False."""
        assert is_valid_uuid(None) is False
    
    def test_is_valid_uuid_with_invalid_type(self):
        """Test invalid type returns False."""
        assert is_valid_uuid(123) is False
        assert is_valid_uuid([]) is False
        assert is_valid_uuid({}) is False


class TestGenerateUUID:
    """Tests for UUID generation functions."""
    
    def test_generate_uuid(self):
        """Test generate_uuid returns UUID object."""
        result = generate_uuid()
        
        assert isinstance(result, UUID)
        assert result.version == 4  # UUID4
    
    def test_generate_uuid_str(self):
        """Test generate_uuid_str returns string."""
        result = generate_uuid_str()
        
        assert isinstance(result, str)
        assert is_valid_uuid(result)
    
    def test_generate_uuid_unique(self):
        """Test generated UUIDs are unique."""
        uuid1 = generate_uuid()
        uuid2 = generate_uuid()
        
        assert uuid1 != uuid2


class TestUUIDConverter:
    """Tests for UUIDConverter context manager."""
    
    def test_converter_basic_usage(self):
        """Test basic UUID conversion."""
        with UUIDConverter() as converter:
            uuid_str = "00000000-0000-0000-0000-000000000001"
            result = converter.convert(uuid_str)
            
            assert isinstance(result, UUID)
            assert str(result) == uuid_str
    
    def test_converter_multiple_conversions(self):
        """Test multiple conversions in same context."""
        with UUIDConverter() as converter:
            uuid1 = converter.convert("00000000-0000-0000-0000-000000000001")
            uuid2 = converter.convert("00000000-0000-0000-0000-000000000002")
            uuid3 = converter.convert(None)
            
            assert isinstance(uuid1, UUID)
            assert isinstance(uuid2, UUID)
            assert uuid3 is None
            assert len(converter.conversions) == 3
    
    def test_converter_tracks_conversions(self):
        """Test conversion tracking."""
        with UUIDConverter() as converter:
            original = "00000000-0000-0000-0000-000000000001"
            result = converter.convert(original)
            
            assert len(converter.conversions) == 1
            assert converter.conversions[0][0] == original
            assert converter.conversions[0][1] == result


class TestConstants:
    """Tests for UUID constants."""
    
    def test_null_uuid(self):
        """Test NULL_UUID is correct."""
        assert isinstance(NULL_UUID, UUID)
        assert str(NULL_UUID) == "00000000-0000-0000-0000-000000000000"
    
    def test_null_uuid_str(self):
        """Test NULL_UUID_STR is correct."""
        assert isinstance(NULL_UUID_STR, str)
        assert NULL_UUID_STR == "00000000-0000-0000-0000-000000000000"
    
    def test_null_uuid_consistency(self):
        """Test NULL_UUID and NULL_UUID_STR are consistent."""
        assert str(NULL_UUID) == NULL_UUID_STR


class TestIntegrationScenarios:
    """Integration tests simulating real-world scenarios."""
    
    def test_api_request_flow(self):
        """Test typical API request flow with UUID conversion."""
        # Simulate user ID from request (often comes as string)
        user_id_from_request = "00000000-0000-0000-0000-000000000001"
        
        # Convert for database query
        user_id = ensure_uuid(user_id_from_request)
        
        # Verify it can be used in comparisons
        assert isinstance(user_id, UUID)
        
        # Simulate conversion back for JSON response
        response_data = {"user_id": uuid_to_str(user_id)}
        assert isinstance(response_data["user_id"], str)
    
    def test_optional_uuid_parameter(self):
        """Test handling optional UUID parameter."""
        # No config_id provided
        config_id = None
        converted_id = ensure_uuid(config_id)
        assert converted_id is None
        
        # Config_id provided as string
        config_id = "00000000-0000-0000-0000-000000000002"
        converted_id = ensure_uuid(config_id)
        assert isinstance(converted_id, UUID)
    
    def test_uuid_validation_before_query(self):
        """Test UUID validation before database query."""
        # Valid UUID
        user_id = "00000000-0000-0000-0000-000000000001"
        assert is_valid_uuid(user_id)
        safe_user_id = ensure_uuid(user_id)
        assert isinstance(safe_user_id, UUID)
        
        # Invalid UUID
        bad_id = "not-a-uuid"
        assert not is_valid_uuid(bad_id)
        
        with pytest.raises(ValueError):
            ensure_uuid(bad_id)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
