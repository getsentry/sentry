# Token & Session Security Patterns

## Contents

- Token refresh validation
- Org-level token scoping
- Member status checks
- Impersonation controls

## Token Refresh Validation

### Real vulnerability: Inactive app token refresh (PR #105269)

SentryApps that were deactivated (unpublished, disabled) could still refresh their API tokens.

**Pattern to check:** Any token refresh flow must verify the application/integration is still active before issuing a new token. The check may live in the authentication class, the endpoint handler, OR a downstream business logic class — trace the full chain before reporting.

**Known enforcement point:** `Validator._validate_application_is_active()` in `sentry_apps/token_exchange/validator.py` checks `ApiApplication.is_active`. This is called by `ManualTokenRefresher`, `Refresher`, and `GrantExchanger` before issuing tokens.

```python
# WRONG: Refresh without checking app status anywhere in the chain
def refresh_token(self, request):
    app = SentryApp.objects.get(id=token.application.sentry_app_id)
    new_token = rotate_token(token)
    return Response({"token": new_token})

# RIGHT: Check active status (can be in auth class, handler, or business logic)
def refresh_token(self, request):
    app = SentryApp.objects.get(id=token.application.sentry_app_id)
    if app.status != SentryAppStatus.PUBLISHED:
        return Response({"detail": "Application is not active"}, status=403)
    new_token = rotate_token(token)
    return Response({"token": new_token})
```

## Org-Level Token Scoping

### Real vulnerability: Missing organization_id (PR #105064)

OAuth applications with org-level access did not require `organization_id`, allowing tokens to be used across organizations.

**Pattern to check:** Token **issuance and refresh** endpoints for org-scoped tokens must require and validate `organization_id` before granting access.

**This does NOT apply to authentication classes that read existing tokens.** For `OrgAuthTokenAuthentication`, org scoping is enforced by the permission layer: `from_rpc_auth()` in `auth/access.py` compares `auth.organization_id` against the requested organization and returns `NoAccess()` on mismatch. Do not report `OrgAuthTokenAuthentication` as missing org scoping — it is enforced downstream.

## Member Status Checks

### Real vulnerability: Disabled member tokens (PR #92616)

Disabled organization members could still request auth tokens.

**Pattern to check:** Before issuing any token, verify the member is not disabled:

```python
# Check member status
member = OrganizationMember.objects.get(
    user_id=request.user.id,
    organization_id=organization.id
)
if member.is_pending or not member.user_is_active:
    return Response({"detail": "Member is not active"}, status=403)
```

### Real vulnerability: Personal tokens managing org tokens (PR #99457)

Personal API tokens could perform actions on organization auth tokens, bypassing org-level authorization.

**Pattern to check:** Org token management endpoints must verify the auth method is appropriate (org-level auth, not personal token).

## Impersonation Rate Limiting

### Real vulnerability: No rate limits on impersonation (PR #106814)

Impersonated sessions (staff acting as a user) had no rate limiting, allowing unrestricted API access.

**Pattern to check:** Impersonated sessions should have rate limits applied.

## Checklist

```
□ Token refresh checks application/integration active status (in auth class, handler, OR business logic)
□ Token issuance/refresh endpoints for org-scoped tokens require and validate organization_id
  (authentication classes reading existing tokens are exempt — org scoping is enforced by from_rpc_auth())
□ Member active status is checked before token issuance
□ Auth method is appropriate for the operation (org token vs personal token)
□ Impersonated sessions are rate-limited
□ Token revocation cascades properly (revoking app revokes all its tokens)
```
