# API Rate Limiting Changes Summary

## Issue
Per-user rate limits were not being applied to API tokens/integrations. Specifically, API tokens for integrations (Sentry apps) were using organization-based rate limiting instead of per-user rate limiting.

## Root Cause
In `src/sentry/ratelimits/utils.py`, the rate limiting logic had a condition `if request_user.is_sentry_app:` that forced integration API tokens to use organization-based rate limiting instead of per-user rate limiting.

## Changes Made

### 1. Modified Rate Limiting Logic (`src/sentry/ratelimits/utils.py`)

**Before:**
```python
if is_api_token_auth(request_auth) and request_user:
    # ... token ID extraction logic ...

    if request_user.is_sentry_app:
        category = "org"
        id = get_organization_id_from_token(token_id)

        # Fallback to IP address limit if we can't find the organization
        if id is None and ip_address is not None:
            category = "ip"
            id = ip_address
    else:
        category = "user"
        id = request_auth.user_id
```

**After:**
```python
if is_api_token_auth(request_auth) and request_user:
    # ... token ID extraction logic ...

    # Apply per-user rate limiting for all API tokens
    category = "user"
    id = request_auth.user_id
```

### 2. Updated Test Cases (`tests/sentry/ratelimits/utils/test_get_ratelimit_key.py`)

- Modified `test_integration_tokens()` to expect user-based rate limiting instead of organization-based

## How It Works

### For All API Tokens (including integrations):
- All API tokens now use per-user rate limiting based on the token's user
- Rate limiting uses the pattern: `user:{group}:{method}:{token_user_id}`
- This includes both regular user API tokens and integration/Sentry app API tokens

### For Organization Auth Tokens:
- Continue to use IP-based rate limiting (unchanged)
- Rate limiting uses the pattern: `ip:{group}:{method}:{ip_address}`

### For API Keys:
- Continue to use IP-based rate limiting (unchanged)
- Rate limiting uses the pattern: `ip:{group}:{method}:{ip_address}`

## Benefits

1. **Consistent Rate Limiting**: All API tokens (including integrations) now use per-user rate limits
2. **Security**: Prevents users from circumventing rate limits by creating integration tokens
3. **Simplicity**: Single, consistent rate limiting behavior for all API tokens
4. **Fair Usage**: API usage through integration tokens counts against the user's rate limits

## Token Types Summary

| Token Type | Rate Limiting Behavior | Pattern |
|------------|----------------------|---------|
| ApiToken (User) | Per-user (based on token owner) | `user:{group}:{method}:{user_id}` |
| ApiToken (Integration/Sentry App) | Per-user (based on token owner) | `user:{group}:{method}:{user_id}` |
| OrgAuthToken | IP-based | `ip:{group}:{method}:{ip_address}` |
| ApiKey | IP-based | `ip:{group}:{method}:{ip_address}` |

This simple change ensures that per-user rate limits now properly apply to all API tokens, including those used by integrations.
