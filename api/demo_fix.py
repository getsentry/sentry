"""
Demonstration of the UUID parsing bug and its fix.

Original Error:
    ValueError: badly formed hexadecimal UUID string
    (occurred in: /api/v1/auth/mfa/logs)

Root Cause:
    The code attempted to convert a non-UUID user ID string 
    ('user_1766682119.873619') into a UUID object without validation.
"""

from uuid import UUID
from typing import Union


def is_valid_uuid(value: str) -> bool:
    """
    Check if a string is a valid UUID.
    
    Args:
        value: String to check
        
    Returns:
        True if the string is a valid UUID, False otherwise
    """
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def buggy_version(user_id_str: str) -> UUID:
    """
    BUGGY VERSION - This is what caused the original error.
    
    Directly converts string to UUID without validation.
    This fails for non-UUID strings like 'user_1766682119.873619'.
    """
    return UUID(user_id_str)  # This raises ValueError for invalid UUIDs


def fixed_version(user_id_str: str) -> Union[str, UUID]:
    """
    FIXED VERSION - Handles both UUID and non-UUID strings gracefully.
    
    Checks if the string is a valid UUID before converting.
    If it's not a valid UUID, returns it as a string instead.
    """
    if is_valid_uuid(user_id_str):
        return UUID(user_id_str)
    else:
        return user_id_str  # Keep as string for non-UUID IDs


def demo():
    """Demonstrate the bug and the fix."""
    print("=" * 70)
    print("UUID PARSING BUG DEMONSTRATION")
    print("=" * 70)
    
    # Test cases
    test_cases = [
        ("user_1766682119.873619", "Non-UUID user ID (caused original error)"),
        ("550e8400-e29b-41d4-a716-446655440000", "Valid UUID string"),
        ("test_user_123", "Another non-UUID ID"),
        ("invalid-uuid-format", "Invalid UUID format"),
    ]
    
    print("\n1. BUGGY VERSION (original code):")
    print("-" * 70)
    
    for user_id, description in test_cases:
        print(f"\nTesting: {user_id}")
        print(f"Type: {description}")
        try:
            result = buggy_version(user_id)
            print(f"✓ Success: Converted to UUID {result}")
        except ValueError as e:
            print(f"✗ ERROR: {e}")
    
    print("\n" + "=" * 70)
    print("\n2. FIXED VERSION (with validation):")
    print("-" * 70)
    
    for user_id, description in test_cases:
        print(f"\nTesting: {user_id}")
        print(f"Type: {description}")
        try:
            result = fixed_version(user_id)
            if isinstance(result, UUID):
                print(f"✓ Success: Converted to UUID {result}")
            else:
                print(f"✓ Success: Kept as string '{result}'")
        except ValueError as e:
            print(f"✗ ERROR: {e}")
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("""
The fix adds validation before UUID conversion:

BEFORE (buggy):
    user_id = UUID(current_user["id"])  # Crashes on non-UUID strings

AFTER (fixed):
    if is_valid_uuid(current_user["id"]):
        user_id = UUID(current_user["id"])
    else:
        user_id = current_user["id"]  # Keep as string

This allows the API to handle:
  • Real UUID user IDs (from production databases)
  • Test user IDs (like 'user_1766682119.873619')
  • Mock user IDs (like 'test_user_123')
  • Any other string-based user identifier

The service layer has been updated to accept Union[str, UUID] types,
ensuring compatibility with all user ID formats.
""")


if __name__ == "__main__":
    demo()
