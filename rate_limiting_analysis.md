# Integration Rate Limiting Analysis

## Current State

### Organization-Wide Rate Limiting in RateLimitConfig

Currently, integrations and API keys use organization-wide rate limiting in the rate limit key generation logic:

**File**: `src/sentry/ratelimits/utils.py`
```python
if request_user.is_sentry_app:
    category = "org"  # <-- This causes organization-based rate limiting
    id = get_organization_id_from_token(token_id)
```

This means that when Sentry apps (integrations) make API requests using tokens, they are rate-limited per organization rather than per user/integration.

### Rate Limiting Categories

The system supports three categories of rate limiting:
1. **User-based** (`category = "user"`): Rate limits per individual user
2. **Organization-based** (`category = "org"`): Rate limits per organization
3. **IP-based** (`category = "ip"`): Rate limits per IP address

## Problem

Integrations currently use organization-based rate limiting, which means:
- All integrations within an organization share the same rate limit pool
- Heavy usage by one integration can exhaust the rate limit for all integrations in the organization
- Poor resource allocation and user experience

## Solution

Change integrations to use user-based rate limiting instead of organization-based rate limiting.

## Implementation

### Change Made

**File**: `src/sentry/ratelimits/utils.py`

Changed the rate limiting category for Sentry apps (integrations) from organization-based to user-based:

```python
# Before:
if request_user.is_sentry_app:
    category = "org"
    id = get_organization_id_from_token(token_id)

# After:
if request_user.is_sentry_app:
    category = "user"
    id = request_auth.user_id
```

Also removed the unused `get_organization_id_from_token` function since it's no longer needed.

## Benefits

- **Fairer Resource Allocation**: Users can't exhaust the rate limit for an entire organization
- **Better User Experience**: One user's heavy usage doesn't impact other users in the same organization
- **Improved Security**: Limits the impact of compromised user accounts
- **Scalability**: Rate limits scale with user count rather than organization size

## Risks and Considerations

- **Backward Compatibility**: Ensure existing integrations continue to work
- **Anonymous/System Actions**: Need fallback mechanisms for non-user-initiated actions
- **Rate Limit Tuning**: May need to adjust limits based on per-user vs per-organization usage patterns
