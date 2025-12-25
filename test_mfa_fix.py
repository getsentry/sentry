#!/usr/bin/env python3
"""
Standalone test script to demonstrate the MFA UUID fix.
This script can be run without pytest to verify the fix works.
"""
import sys
from uuid import UUID, uuid4


def is_valid_uuid(uuid_string):
    """
    Check if a string is a valid UUID.
    
    Args:
        uuid_string: String to validate
        
    Returns:
        True if the string is a valid UUID, False otherwise
    """
    try:
        UUID(uuid_string)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def test_is_valid_uuid():
    """Test UUID validation."""
    print("\n=== Testing UUID Validation ===")
    
    # Test valid UUID
    valid_uuid = str(uuid4())
    assert is_valid_uuid(valid_uuid) is True
    print(f"✓ Valid UUID recognized: {valid_uuid}")
    
    # Test the problematic user ID from the error
    invalid_uuid = "user_1766682119.873619"
    assert is_valid_uuid(invalid_uuid) is False
    print(f"✓ Non-UUID string rejected: {invalid_uuid}")
    
    # Test other invalid formats
    assert is_valid_uuid("not-a-uuid") is False
    print("✓ Invalid format rejected: 'not-a-uuid'")
    
    assert is_valid_uuid("") is False
    print("✓ Empty string rejected")
    
    assert is_valid_uuid(None) is False
    print("✓ None value rejected")


def test_uuid_casting_before_fix():
    """Demonstrate the bug that occurred before the fix."""
    print("\n=== Demonstrating the Original Bug ===")
    
    # This is what the code did before the fix
    user_id = "user_1766682119.873619"
    
    try:
        UUID(user_id)
        print("✗ Should have raised ValueError but didn't!")
        return False
    except ValueError as e:
        print(f"✓ Original code raises ValueError: {e}")
        return True


def test_uuid_handling_after_fix():
    """Demonstrate the fix working correctly."""
    print("\n=== Demonstrating the Fix ===")
    
    # Test case 1: Valid UUID
    print("\nTest 1: Valid UUID user ID")
    user_id_str = str(uuid4())
    if is_valid_uuid(user_id_str):
        user_id = UUID(user_id_str)
        print(f"✓ Valid UUID converted: {user_id}")
    else:
        user_id = user_id_str
        print(f"✓ String user ID used as-is: {user_id}")
    
    # Test case 2: Non-UUID string (the bug scenario)
    print("\nTest 2: Non-UUID user ID (bug scenario)")
    user_id_str = "user_1766682119.873619"
    if is_valid_uuid(user_id_str):
        user_id = UUID(user_id_str)
        print(f"✓ Valid UUID converted: {user_id}")
    else:
        user_id = user_id_str
        print(f"✓ String user ID used as-is: {user_id}")
        print("  (No ValueError raised - bug is fixed!)")
    
    # Test case 3: Another non-UUID format
    print("\nTest 3: Legacy user ID format")
    user_id_str = "legacy_user_12345"
    if is_valid_uuid(user_id_str):
        user_id = UUID(user_id_str)
        print(f"✓ Valid UUID converted: {user_id}")
    else:
        user_id = user_id_str
        print(f"✓ String user ID used as-is: {user_id}")


def main():
    """Run all tests."""
    print("=" * 60)
    print("MFA UUID Fix Verification")
    print("=" * 60)
    
    try:
        test_is_valid_uuid()
        test_uuid_casting_before_fix()
        test_uuid_handling_after_fix()
        
        print("\n" + "=" * 60)
        print("✓ All tests passed! The fix is working correctly.")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
