# Integration Rate Limiting Analysis

## Current State

### Organization-Wide Rate Limiting in Integrations

Currently, integrations use organization-wide rate limiting in several places:

1. **Data Forwarding Plugin** (`src/sentry/plugins/bases/data_forwarding.py`):
   ```python
   def get_rl_key(self, event):
       return f"{self.conf_key}:{event.project.organization_id}"
   ```

2. **Integration Webhooks** (e.g., `src/sentry/integrations/jira/webhooks/issue_updated.py`):
   ```python
   rate_limits = {
       "POST": {
           RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=1),
           # ...
       },
   }
   ```

3. **Integration Mailbox System** (`src/sentry/integrations/middleware/hybrid_cloud/parser.py`):
   ```python
   ratelimit_key = f"webhookpayload:{self.provider}:{integration.id}"
   ```

### User-Based Rate Limiting Infrastructure

The system already supports user-based rate limiting through:

1. **Rate Limit Middleware** (`src/sentry/middleware/ratelimit.py`):
   - Automatically detects authenticated users
   - Constructs rate limit keys with user ID when `request.user` is available
   - Key format: `user:{rate_limit_group}:{view}:{http_method}:{user_id}`

2. **Integration Request Context**:
   - Integration endpoints have access to `request.user` when webhooks are triggered by authenticated users
   - Many integration endpoints already use `request.user` for serialization and authorization

## Changes Needed

### 1. Update Data Forwarding Plugin

**File**: `src/sentry/plugins/bases/data_forwarding.py`

Change the rate limit key from organization-based to user-based:

```python
def get_rl_key(self, event):
    # Check if we have a user context from the request
    if hasattr(self, 'request') and self.request and hasattr(self.request, 'user') and self.request.user.is_authenticated:
        return f"{self.conf_key}:user:{self.request.user.id}"
    # Fallback to project-based rate limiting if no user context
    return f"{self.conf_key}:project:{event.project.id}"
```

### 2. Update Integration Webhook Rate Limits

**Files**: Multiple webhook files in `src/sentry/integrations/*/webhooks/`

Change rate limit configuration from organization-based to user-based:

```python
rate_limits = {
    "POST": {
        RateLimitCategory.IP: RateLimit(limit=100, window=1),
        RateLimitCategory.USER: RateLimit(limit=100, window=1),
        # Remove or reduce ORGANIZATION limits
        RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=1),  # Higher limit as fallback
    },
}
```

### 3. Update Integration Mailbox System

**File**: `src/sentry/integrations/middleware/hybrid_cloud/parser.py`

The integration mailbox system should continue using integration-based rate limiting as it's designed for webhook volume management, not user actions.

## Implementation Strategy

1. ✅ **Phase 1**: Update Data Forwarding Plugin to use project-based rate limiting (more appropriate than organization-wide)
2. ✅ **Phase 2**: Update integration webhook endpoints to prioritize user-based rate limiting
3. **Phase 3**: Monitor and adjust rate limits based on usage patterns

## Changes Made

### 1. Data Forwarding Plugin Updated
**File**: `src/sentry/plugins/bases/data_forwarding.py`
- Changed from organization-based (`organization_id`) to project-based (`project.id`) rate limiting
- This is more appropriate since data forwarding operates in server-side event processing without user context

### 2. Integration Webhook Endpoints Updated
**Files**:
- `src/sentry/integrations/jira/webhooks/issue_updated.py`
- `src/sentry/integrations/vsts/webhooks.py`
- `src/sentry/integrations/jira_server/webhooks.py`

**Changes**:
- Reduced USER rate limit from 100 to 50 requests per second (making it the primary limit)
- Increased ORGANIZATION rate limit from 100 to 1000 requests per second (as a fallback)
- This prioritizes user-based rate limiting while maintaining organization-wide limits as a safety net

## Benefits

- **Fairer Resource Allocation**: Users can't exhaust the rate limit for an entire organization
- **Better User Experience**: One user's heavy usage doesn't impact other users in the same organization
- **Improved Security**: Limits the impact of compromised user accounts
- **Scalability**: Rate limits scale with user count rather than organization size

## Risks and Considerations

- **Backward Compatibility**: Ensure existing integrations continue to work
- **Anonymous/System Actions**: Need fallback mechanisms for non-user-initiated actions
- **Rate Limit Tuning**: May need to adjust limits based on per-user vs per-organization usage patterns
