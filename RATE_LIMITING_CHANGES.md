# API Rate Limiting Changes Summary

## Issue
Per-user rate limits were not being applied to API tokens/integrations. Specifically, organization auth tokens (OrgAuthTokens) were falling back to IP-based rate limiting instead of being rate limited per the user who created them.

## Root Cause
In `src/sentry/ratelimits/utils.py`, the rate limiting logic had a comment indicating that "ApiKeys & OrgAuthTokens will be treated with IP ratelimits". This meant that organization auth tokens created by users were not subject to per-user rate limiting, which was the intended behavior.

## Changes Made

### 1. Modified Rate Limiting Logic (`src/sentry/ratelimits/utils.py`)

**Before:**
```python
# ApiKeys & OrgAuthTokens will be treated with IP ratelimits
elif ip_address is not None:
    category = "ip"
    id = ip_address
```

**After:**
```python
# Check if this is an org auth token and apply per-user rate limiting
elif is_org_auth_token_auth(request_auth):
    # Get the user ID who created the org auth token for per-user rate limiting
    created_by_id = None
    if isinstance(request_auth, AuthenticatedToken) and request_auth.entity_id is not None:
        # For AuthenticatedToken, we need to get the created_by_id from the actual token
        from sentry.models.orgauthtoken import OrgAuthToken
        from sentry.hybridcloud.models.orgauthtokenreplica import OrgAuthTokenReplica
        from sentry.silo.base import SiloMode

        try:
            if SiloMode.get_current_mode() == SiloMode.REGION:
                token = OrgAuthTokenReplica.objects.get(orgauthtoken_id=request_auth.entity_id)
                created_by_id = token.created_by_id
            else:
                token = OrgAuthToken.objects.get(id=request_auth.entity_id)
                created_by_id = token.created_by_id
        except (OrgAuthToken.DoesNotExist, OrgAuthTokenReplica.DoesNotExist):
            pass
    else:
        # For direct OrgAuthToken objects
        created_by_id = getattr(request_auth, "created_by_id", None)

    if created_by_id:
        category = "user"
        id = created_by_id
    elif ip_address is not None:
        # Fallback to IP if we can't get the creator
        category = "ip"
        id = ip_address
    else:
        return None

# ApiKeys will be treated with IP ratelimits
elif ip_address is not None:
    category = "ip"
    id = ip_address
```

### 2. Updated Test Cases (`tests/sentry/ratelimits/utils/test_get_ratelimit_key.py`)

- Modified `test_org_auth_token()` to expect user-based rate limiting instead of IP-based
- Added `test_org_auth_token_no_creator()` to test fallback behavior when no creator is available

## How It Works

### For OrgAuthTokens with a Creator:
1. When a request uses an organization auth token, the system now checks for the `created_by_id` field
2. If a creator is found, rate limiting uses the pattern: `user:{group}:{method}:{creator_user_id}`
3. This ensures that all API requests using that organization's tokens count against the creating user's rate limit

### For OrgAuthTokens without a Creator:
1. If no creator is found (e.g., legacy tokens), the system falls back to IP-based rate limiting
2. Rate limiting uses the pattern: `ip:{group}:{method}:{ip_address}`

### For API Tokens (ApiToken):
- These already worked correctly and continue to use per-user rate limiting
- Rate limiting uses the pattern: `user:{group}:{method}:{token_user_id}`

### For API Keys:
- These continue to use IP-based rate limiting as before (intentional design)
- Rate limiting uses the pattern: `ip:{group}:{method}:{ip_address}`

## Benefits

1. **Consistent Rate Limiting**: Organization auth tokens now respect per-user rate limits, preventing abuse through token proliferation
2. **Backward Compatibility**: Legacy tokens without creators still work (fall back to IP-based limiting)
3. **Security**: Prevents users from circumventing rate limits by creating multiple organization tokens
4. **Fair Usage**: Ensures that API usage through tokens counts against the same limits as direct user API usage

## Token Types Summary

| Token Type | Rate Limiting Behavior | Pattern |
|------------|----------------------|---------|
| ApiToken (User) | Per-user (based on token owner) | `user:{group}:{method}:{user_id}` |
| OrgAuthToken | Per-user (based on creator) | `user:{group}:{method}:{creator_id}` |
| OrgAuthToken (no creator) | IP-based (fallback) | `ip:{group}:{method}:{ip_address}` |
| ApiKey | IP-based | `ip:{group}:{method}:{ip_address}` |

This change ensures that per-user rate limits now properly apply to API tokens and integrations as requested.
