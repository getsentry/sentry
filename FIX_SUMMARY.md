# Fix Summary: HTTPException 'dict' object has no attribute 'model_dump'

## Issue
The endpoint `/api/v1/networking/connections/request` was returning HTTP 500 errors with:
```
AttributeError: 'dict' object has no attribute 'model_dump'
```

## Root Cause
The `create_connection_request()` service function returned a plain Python dictionary, but the API endpoint tried to call `.model_dump()` on it, which is a Pydantic model method.

## Solution
Changed `create_connection_request()` in `api/services.py` to return a `ConnectionRequest` Pydantic model instead of a dictionary.

### Code Changes

**Before (Buggy):**
```python
def create_connection_request(...) -> Dict:
    connection_request = {...}
    return connection_request  # Returns dict
```

**After (Fixed):**
```python
def create_connection_request(...) -> ConnectionRequest:
    connection_request_data = {...}
    return ConnectionRequest(**connection_request_data)  # Returns Pydantic model
```

## Verification
✓ All tests pass
✓ Endpoint now returns 200 OK with proper JSON response
✓ No more AttributeError exceptions

## Files
- `api/services.py` - Fixed the return type
- `api/routes/networking.py` - Updated documentation
- `api/test_networking_fixed.py` - Tests verifying the fix
- `api/demo_bug_and_fix.py` - Demonstration of bug vs fix
- `api/README.md` - Comprehensive documentation
