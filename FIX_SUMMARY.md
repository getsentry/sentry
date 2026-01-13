# Fix Summary: ConnectionError in check_auth_identities Task

## Problem

The `check_auth_identities` task was encountering a `ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))` when attempting to refresh OAuth2 tokens for Fly.io authentication identities.

### Root Cause

The Fly.io OAuth2 provider's `client_secret` was not configured (returned `None` from `options.get("auth-fly.client-secret")`). When the `refresh_identity` method attempted to refresh the token:

1. It called `get_refresh_token_params()` which included `client_secret: None`
2. The `requests` library automatically omits parameters with `None` values from POST requests
3. The Fly.io API received an incomplete OAuth2 token refresh request (missing `client_secret`)
4. Instead of returning an HTTP error response, Fly.io abruptly closed the connection
5. This caused a `RemoteDisconnected` exception, wrapped in a `ConnectionError`

## Solution

Added validation in the `OAuth2Provider.refresh_identity()` method to check that both `client_id` and `client_secret` are configured before making the HTTP request.

### Changes Made

**File: `src/sentry/auth/providers/oauth2.py`**

Added credential validation before the `safe_urlopen()` call:

```python
def refresh_identity(self, auth_identity: AuthIdentity) -> None:
    refresh_token = auth_identity.data.get("refresh_token")

    if not refresh_token:
        raise IdentityNotValid("Missing refresh token")

    # NEW: Validate that required OAuth2 credentials are configured
    client_id = self.get_client_id()
    client_secret = self.get_client_secret()
    
    if not client_id:
        raise IdentityNotValid("OAuth2 client_id is not configured")
    
    if not client_secret:
        raise IdentityNotValid("OAuth2 client_secret is not configured")

    # Now safe to make the HTTP request
    data = self.get_refresh_token_params(refresh_token=refresh_token)
    req = safe_urlopen(self.get_refresh_token_url(), data=data)
    ...
```

**File: `tests/sentry/auth/providers/test_oauth2.py`**

Added comprehensive tests to verify the validation:
- `test_refresh_identity_without_client_id()` - Validates empty client_id is caught
- `test_refresh_identity_without_client_secret()` - Validates empty client_secret is caught
- `test_refresh_identity_with_none_client_secret()` - Validates None client_secret is caught

## Benefits

### Before the Fix
- Missing credentials caused `ConnectionError` with cryptic error message
- Exception was caught by generic `Exception` handler
- Logged as `auth.identities.refresh_error` metric
- Full stack trace logged, making it harder to identify the root cause

### After the Fix
- Missing credentials raise `IdentityNotValid` with clear error message
- Exception is caught by specific `IdentityNotValid` handler
- Logged as `auth.identities.invalidated` metric (more appropriate)
- Clean warning message: "AuthIdentity(id=X) notified as not valid: OAuth2 client_secret is not configured"
- Identity is properly marked as invalid, triggering appropriate security measures

## Impact

1. **Prevents Connection Errors**: No more `RemoteDisconnected` exceptions when OAuth2 credentials are misconfigured
2. **Better Error Messages**: Clear indication of what's missing ("OAuth2 client_secret is not configured")
3. **Proper Error Handling**: Uses the existing `IdentityNotValid` exception path designed for auth failures
4. **Security**: Maintains the security posture by marking identities as invalid when credentials are missing
5. **Observability**: Clearer metrics and logs for debugging configuration issues

## Testing

The fix includes:
1. Unit tests in `tests/sentry/auth/providers/test_oauth2.py`
2. Validation for both `client_id` and `client_secret`
3. Handles both empty strings and `None` values

## Deployment Notes

This fix is backward compatible and requires no configuration changes. It will:
- Prevent future connection errors when OAuth2 credentials are misconfigured
- Properly handle existing misconfigured providers by marking them as invalid
- Provide clear error messages for operators to identify and fix configuration issues

## Related Files

- `src/sentry/auth/providers/oauth2.py` - Core fix
- `src/sentry/auth/providers/fly/provider.py` - Fly.io provider implementation
- `src/sentry/tasks/auth/check_auth.py` - Task that calls refresh_identity
- `tests/sentry/auth/providers/test_oauth2.py` - Unit tests
