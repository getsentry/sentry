"""Simple test to verify the UUID utility functions work correctly."""
import uuid
import pytest

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
    
    def test_converts_valid_uuid_string(self):
        """Test conversion of valid UUID string to UUID object."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        result = ensure_uuid(uuid_str)
        
        assert isinstance(result, uuid.UUID)
        assert str(result) == uuid_str
    
    def test_preserves_uuid_object(self):
        """Test that UUID objects are preserved."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        result = ensure_uuid(uuid_obj)
        
        assert isinstance(result, uuid.UUID)
        assert result == uuid_obj
        assert result is uuid_obj  # Same object
    
    def test_handles_none(self):
        """Test that None is handled correctly."""
        result = ensure_uuid(None)
        assert result is None
    
    def test_raises_on_invalid_uuid_string(self):
        """Test that invalid UUID strings raise ValueError."""
        with pytest.raises(ValueError, match="Invalid UUID string"):
            ensure_uuid("not-a-valid-uuid")
    
    def test_raises_on_wrong_type(self):
        """Test that wrong types raise TypeError."""
        with pytest.raises(TypeError):
            ensure_uuid(12345)
        
        with pytest.raises(TypeError):
            ensure_uuid([])


class TestUUIDToStr:
    """Tests for uuid_to_str function."""
    
    def test_converts_uuid_object_to_string(self):
        """Test conversion of UUID object to string."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        result = uuid_to_str(uuid_obj)
        
        assert isinstance(result, str)
        assert result == "00000000-0000-0000-0000-000000000001"
    
    def test_validates_uuid_string(self):
        """Test that UUID strings are validated."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        result = uuid_to_str(uuid_str)
        
        assert isinstance(result, str)
        assert result == uuid_str
    
    def test_handles_none(self):
        """Test that None is handled correctly."""
        result = uuid_to_str(None)
        assert result is None
    
    def test_raises_on_invalid_uuid_string(self):
        """Test that invalid UUID strings raise ValueError."""
        with pytest.raises(ValueError, match="Invalid UUID string"):
            uuid_to_str("not-a-valid-uuid")


class TestIsValidUUID:
    """Tests for is_valid_uuid function."""
    
    def test_valid_uuid_object(self):
        """Test that valid UUID objects return True."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        assert is_valid_uuid(uuid_obj) is True
    
    def test_valid_uuid_string(self):
        """Test that valid UUID strings return True."""
        assert is_valid_uuid("00000000-0000-0000-0000-000000000001") is True
    
    def test_invalid_uuid_string(self):
        """Test that invalid UUID strings return False."""
        assert is_valid_uuid("not-a-uuid") is False
    
    def test_none_returns_false(self):
        """Test that None returns False."""
        assert is_valid_uuid(None) is False
    
    def test_wrong_type_returns_false(self):
        """Test that wrong types return False."""
        assert is_valid_uuid(12345) is False
        assert is_valid_uuid([]) is False


class TestGenerateUUID:
    """Tests for UUID generation functions."""
    
    def test_generate_uuid_returns_uuid_object(self):
        """Test that generate_uuid returns a UUID object."""
        result = generate_uuid()
        
        assert isinstance(result, uuid.UUID)
        assert result.version == 4
    
    def test_generate_uuid_str_returns_string(self):
        """Test that generate_uuid_str returns a string."""
        result = generate_uuid_str()
        
        assert isinstance(result, str)
        assert is_valid_uuid(result) is True
    
    def test_generated_uuids_are_unique(self):
        """Test that generated UUIDs are unique."""
        uuid1 = generate_uuid()
        uuid2 = generate_uuid()
        
        assert uuid1 != uuid2


class TestUUIDConverter:
    """Tests for UUIDConverter context manager."""
    
    def test_context_manager_converts_uuids(self):
        """Test that UUIDConverter works as a context manager."""
        with UUIDConverter() as converter:
            result1 = converter.convert("00000000-0000-0000-0000-000000000001")
            result2 = converter.convert(uuid.UUID("00000000-0000-0000-0000-000000000002"))
            result3 = converter.convert(None)
        
        assert isinstance(result1, uuid.UUID)
        assert isinstance(result2, uuid.UUID)
        assert result3 is None
    
    def test_converter_tracks_conversions(self):
        """Test that converter tracks conversions."""
        with UUIDConverter() as converter:
            converter.convert("00000000-0000-0000-0000-000000000001")
            converter.convert(uuid.UUID("00000000-0000-0000-0000-000000000002"))
        
        assert len(converter.conversions) == 2


class TestNullUUIDConstants:
    """Tests for null UUID constants."""
    
    def test_null_uuid_is_uuid_object(self):
        """Test that NULL_UUID is a UUID object."""
        assert isinstance(NULL_UUID, uuid.UUID)
        assert str(NULL_UUID) == "00000000-0000-0000-0000-000000000000"
    
    def test_null_uuid_str_is_string(self):
        """Test that NULL_UUID_STR is a string."""
        assert isinstance(NULL_UUID_STR, str)
        assert NULL_UUID_STR == "00000000-0000-0000-0000-000000000000"
    
    def test_null_uuid_consistency(self):
        """Test that NULL_UUID and NULL_UUID_STR are consistent."""
        assert str(NULL_UUID) == NULL_UUID_STR


class TestUUIDHexAttribute:
    """
    Tests that demonstrate the root cause of the original bug.
    
    The bug occurred because SQLAlchemy's UUID bind processor expects
    UUID objects (which have a .hex attribute) but was receiving strings
    (which do not have a .hex attribute).
    """
    
    def test_uuid_object_has_hex_attribute(self):
        """Test that UUID objects have the hex attribute."""
        uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
        
        assert hasattr(uuid_obj, "hex")
        assert uuid_obj.hex == "00000000000000000000000000000001"
    
    def test_string_does_not_have_hex_attribute(self):
        """Test that strings do NOT have the hex attribute."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        
        assert not hasattr(uuid_str, "hex")
        
        # This would raise AttributeError (the original bug)
        with pytest.raises(AttributeError, match="'str' object has no attribute 'hex'"):
            _ = uuid_str.hex
    
    def test_ensure_uuid_provides_hex_attribute(self):
        """Test that ensure_uuid provides objects with hex attribute."""
        uuid_str = "00000000-0000-0000-0000-000000000001"
        uuid_obj = ensure_uuid(uuid_str)
        
        # After conversion, we have the hex attribute
        assert hasattr(uuid_obj, "hex")
        assert uuid_obj.hex == "00000000000000000000000000000001"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
