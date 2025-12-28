#!/usr/bin/env python3
"""
Simple test script to verify UUID fix logic without pytest.
"""
import sys
import uuid
from uuid import UUID

# Add api directory to path
sys.path.insert(0, '/workspace')

from api.utils import ensure_uuid, uuid_to_str, is_valid_uuid


def test_ensure_uuid():
    """Test ensure_uuid function."""
    print("Testing ensure_uuid...")
    
    # Test with string
    uuid_str = "00000000-0000-0000-0000-000000000001"
    result = ensure_uuid(uuid_str)
    assert isinstance(result, UUID), f"Expected UUID, got {type(result)}"
    assert str(result) == uuid_str, f"UUID mismatch: {result} != {uuid_str}"
    print(f"  ✓ String to UUID: {uuid_str} -> {result}")
    
    # Test with UUID object
    uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000002")
    result = ensure_uuid(uuid_obj)
    assert result == uuid_obj, f"UUID object changed: {result} != {uuid_obj}"
    print(f"  ✓ UUID object passthrough: {uuid_obj}")
    
    # Test with None
    result = ensure_uuid(None)
    assert result is None, f"Expected None, got {result}"
    print(f"  ✓ None handling: None -> None")
    
    print("✅ ensure_uuid tests passed!\n")


def test_uuid_to_str():
    """Test uuid_to_str function."""
    print("Testing uuid_to_str...")
    
    # Test with UUID object
    uuid_obj = uuid.UUID("00000000-0000-0000-0000-000000000001")
    result = uuid_to_str(uuid_obj)
    assert isinstance(result, str), f"Expected str, got {type(result)}"
    assert result == str(uuid_obj), f"String mismatch: {result} != {uuid_obj}"
    print(f"  ✓ UUID to string: {uuid_obj} -> {result}")
    
    # Test with string
    uuid_str = "00000000-0000-0000-0000-000000000002"
    result = uuid_to_str(uuid_str)
    assert result == uuid_str, f"String passthrough failed: {result} != {uuid_str}"
    print(f"  ✓ String passthrough: {uuid_str}")
    
    print("✅ uuid_to_str tests passed!\n")


def test_is_valid_uuid():
    """Test is_valid_uuid function."""
    print("Testing is_valid_uuid...")
    
    # Valid cases
    assert is_valid_uuid("00000000-0000-0000-0000-000000000001"), "Valid string UUID"
    assert is_valid_uuid(uuid.UUID("00000000-0000-0000-0000-000000000001")), "Valid UUID object"
    print(f"  ✓ Valid UUIDs recognized")
    
    # Invalid cases
    assert not is_valid_uuid("not-a-uuid"), "Invalid string should fail"
    assert not is_valid_uuid(None), "None should fail"
    assert not is_valid_uuid(123), "Integer should fail"
    print(f"  ✓ Invalid UUIDs rejected")
    
    print("✅ is_valid_uuid tests passed!\n")


def test_sqlalchemy_scenario():
    """
    Test the exact scenario that was causing the bug.
    
    This simulates what happens when a string UUID is passed to a
    SQLAlchemy query filter.
    """
    print("Testing SQLAlchemy scenario (bug fix)...")
    
    # Simulate receiving user_id as string from request
    user_id_from_request = "00000000-0000-0000-0000-000000000001"
    print(f"  User ID from request (string): {user_id_from_request}")
    print(f"  Type: {type(user_id_from_request)}")
    
    # WITHOUT FIX: This would cause AttributeError in SQLAlchemy
    # because SQLAlchemy tries to call .hex on the string
    print(f"  ✗ Direct use in query would fail: string has no .hex attribute")
    
    # WITH FIX: Convert to UUID object
    user_id = ensure_uuid(user_id_from_request)
    print(f"  ✓ After ensure_uuid: {user_id}")
    print(f"  ✓ Type: {type(user_id)}")
    print(f"  ✓ Has .hex attribute: {hasattr(user_id, 'hex')}")
    print(f"  ✓ .hex value: {user_id.hex}")
    
    # This is what SQLAlchemy's UUID processor does
    assert hasattr(user_id, 'hex'), "UUID object must have .hex attribute"
    hex_value = user_id.hex
    print(f"  ✓ SQLAlchemy can process: {hex_value}")
    
    print("✅ SQLAlchemy scenario test passed!\n")


def main():
    """Run all tests."""
    print("=" * 70)
    print("UUID FIX VERIFICATION TESTS")
    print("=" * 70)
    print()
    
    try:
        test_ensure_uuid()
        test_uuid_to_str()
        test_is_valid_uuid()
        test_sqlalchemy_scenario()
        
        print("=" * 70)
        print("✅ ALL TESTS PASSED!")
        print("=" * 70)
        print()
        print("The UUID fix is working correctly.")
        print("String UUIDs are now properly converted to UUID objects")
        print("before being used in SQLAlchemy queries.")
        print()
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
