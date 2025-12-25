# MFA UUID Parsing Bug Fix

## Issue Summary

**Error:** `ValueError: badly formed hexadecimal UUID string`  
**Location:** `/api/v1/auth/mfa/logs` endpoint  
**Severity:** High (prevents users from accessing MFA logs)

## Root Cause

The endpoint was attempting to convert user IDs to UUID objects without validation:

```python
# BUGGY CODE (line 486 in api/routes/mfa.py)
logs = service.get_auth_logs(
    user_id=UUID(current_user["id"]),  # ❌ Crashes on non-UUID strings
    event_type=auth_event,
    suspicious_only=suspicious_only,
    limit=limit,
    offset=offset,
)
```

When the authentication system provided a non-UUID user ID (e.g., `'user_1766682119.873619'` from test environments or mock data), the `UUID()` constructor raised a `ValueError` because:

1. The string contains non-hexadecimal characters (underscores, dots)
2. The string length is not 32 characters (required for UUID hex strings)

## The Fix

### 1. Added UUID Validation Helper

```python
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
```

### 2. Updated Endpoint to Validate Before Converting

```python
# FIXED CODE
# Get user ID from current_user
user_id_raw = current_user.get("id")
if not user_id_raw:
    raise HTTPException(
        status_code=400,
        detail="User ID not found in authentication context"
    )

# ✅ Handle both UUID and non-UUID user IDs gracefully
if isinstance(user_id_raw, str) and is_valid_uuid(user_id_raw):
    # If it's a valid UUID string, convert it to UUID object
    user_id: str | UUID = UUID(user_id_raw)
else:
    # Otherwise, keep it as a string (for test users, mock users, etc.)
    user_id = str(user_id_raw)

# Call service with the properly handled user ID
logs = service.get_auth_logs(
    user_id=user_id,  # ✅ Now properly handles both UUID and string
    event_type=auth_event,
    suspicious_only=suspicious_only,
    limit=limit,
    offset=offset,
)
```

### 3. Updated Service Layer to Accept Both Types

```python
class TwoFactorService:
    def get_auth_logs(
        self,
        user_id: str | UUID,  # ✅ Accept both string and UUID
        event_type: Optional[AuthEventType] = None,
        suspicious_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get authentication logs for a user.
        
        Args:
            user_id: User ID as either a string or UUID
            ...
        """
        # Convert UUID to string for consistent handling
        user_id_str = str(user_id) if isinstance(user_id, UUID) else user_id
        
        # ... rest of implementation
```

## Testing

Run the demonstration to verify the fix:

```bash
python3 api/demo_fix.py
```

Expected output:
- Buggy version: Shows `ValueError` for non-UUID strings
- Fixed version: Handles all user ID formats successfully

## Benefits

The fix provides several advantages:

1. **Backward Compatibility**: Still works with valid UUID user IDs
2. **Test Environment Support**: Handles mock/test user IDs gracefully
3. **Flexibility**: Accepts any string-based user identifier
4. **Clear Error Messages**: Provides helpful error responses when needed
5. **Type Safety**: Uses proper type hints (`str | UUID`) for better IDE support

## Affected User Scenarios

This fix resolves issues for:

- **Test environments** with non-UUID user identifiers
- **Mock authentication** systems using string-based IDs
- **Development/staging** environments with simplified user IDs
- **Integration tests** using test fixtures

## Files Modified

1. **`api/routes/mfa.py`**
   - Added `is_valid_uuid()` helper function
   - Updated `get_auth_logs()` endpoint with proper validation
   - Added better error handling and documentation

2. **`services/two_factor_service.py`**
   - Updated method signatures to accept `str | UUID`
   - Added type conversion logic for consistent handling

## Prevention

To prevent similar issues in the future:

1. **Always validate** before converting user-provided data to specific types
2. **Use helper functions** for common validation tasks (like UUID checking)
3. **Accept flexible types** at boundaries (`str | UUID`) and normalize internally
4. **Add comprehensive tests** covering edge cases (non-UUID IDs, invalid formats, etc.)
5. **Document assumptions** about data formats in docstrings

## Rollout Notes

This fix is safe to deploy immediately because:

- No database migrations required
- No API contract changes (accepts same inputs as before)
- Backward compatible with existing UUID-based systems
- Only adds defensive validation logic

## Related Issues

- Original error: `ValueError: badly formed hexadecimal UUID string`
- Stack trace location: `api/routes/mfa.py:486`
- Affected endpoint: `GET /api/v1/auth/mfa/logs`

## Author Notes

This fix follows the principle of **defensive programming** by validating inputs before processing them. The API now gracefully handles various user ID formats while maintaining compatibility with existing UUID-based systems.
