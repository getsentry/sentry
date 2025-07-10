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

- **Fairer Resource Allocation**: Individual integrations can't exhaust the rate limit for all integrations in an organization
- **Better Integration Isolation**: One integration's heavy usage doesn't impact other integrations in the same organization
- **Improved Security**: Limits the impact of compromised integration tokens
- **Scalability**: Rate limits scale with integration count rather than organization size

## Impact

This change affects how API tokens for Sentry apps (integrations) are rate-limited:
- **Before**: All integrations in an organization shared the same rate limit pool (`category = "org"`)
- **After**: Each integration gets its own rate limit based on the user ID associated with the token (`category = "user"`)

The change is minimal and focused - it only modifies the rate limiting categorization logic, not any specific rate limit values or configurations.
