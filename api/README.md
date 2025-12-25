# API Module

This module contains the FastAPI application endpoints for authentication and MFA functionality.

## Fix: UUID Casting Issue in MFA Logs Endpoint

### Problem

The `/api/v1/auth/mfa/logs` endpoint was experiencing a `ValueError` when attempting to retrieve authentication logs for users with non-UUID identifiers.

**Error Message:**
```
ValueError: badly formed hexadecimal UUID string
```

**Root Cause:**
The endpoint code at `api/routes/mfa.py` line 486 was attempting to cast all user IDs to UUID objects without validation:

```python
# Before (line 486):
logs = service.get_auth_logs(
    user_id=UUID(current_user["id"]),  # This fails for non-UUID strings
    ...
)
```

When a user ID like `'user_1766682119.873619'` (used for test users or legacy accounts) was provided, the UUID constructor would fail because this string is not a valid hexadecimal UUID format.

### Solution

Added a validation function `is_valid_uuid()` to check if a string is a valid UUID before attempting to cast it. The endpoint now handles both UUID and non-UUID user identifiers:

```python
# After:
def is_valid_uuid(uuid_string: str) -> bool:
    """Check if a string is a valid UUID."""
    try:
        UUID(uuid_string)
        return True
    except (ValueError, AttributeError, TypeError):
        return False

# In the endpoint:
user_id_str = current_user["id"]

if is_valid_uuid(user_id_str):
    user_id = UUID(user_id_str)
else:
    user_id = user_id_str  # Pass as string for non-UUID IDs

logs = service.get_auth_logs(user_id=user_id, ...)
```

### Service Layer Changes

The `TwoFactorService.get_auth_logs()` method signature was updated to accept both UUID and string types:

```python
def get_auth_logs(
    self,
    user_id: Union[str, UUID],  # Now accepts both types
    ...
) -> List[AuthLog]:
```

### Testing

Run the verification script to confirm the fix:

```bash
python3 test_mfa_fix.py
```

This demonstrates that:
1. Valid UUIDs are properly converted to UUID objects
2. Non-UUID strings (like `'user_1766682119.873619'`) are passed as strings without raising errors
3. The service layer handles both types correctly

### Files Changed

- `api/routes/mfa.py` - Added UUID validation and conditional casting
- `services/two_factor_service.py` - Updated to accept `Union[str, UUID]`
- `tests/api/test_mfa_routes.py` - Added comprehensive tests for both scenarios
