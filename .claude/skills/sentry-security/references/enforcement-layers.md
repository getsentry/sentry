# Enforcement Layers

## Contents

- Where security checks live in a Sentry request
- Layer descriptions and key files
- Tracing requirements

## Overview

Sentry enforces security checks across multiple layers. A check in **any** layer counts as enforcement. Before reporting a missing check, verify it does not exist in any of the layers below.

## Request Lifecycle

```
1. Authentication class     →  authenticate() / authenticate_token()
2. Permission class         →  has_permission()
3. convert_args()           →  resolve URL kwargs → has_object_permission()
4. Access module            →  determine_access() → from_rpc_auth() / from_request()
5. Handler method           →  get() / post() / put() / delete()
6. Business logic classes   →  Validator, Refresher, GrantExchanger, etc.
7. Serializer               →  validate_*() methods, FK scoping
```

## Layer Details

### Layer 1: Authentication (`api/authentication.py`)

Verifies identity and token validity. May also enforce scoping (e.g., `UserAuthTokenAuthentication` checks `scoping_organization_id` at lines 530-555).

Not all authentication classes enforce scoping — some delegate to downstream layers.

### Layer 2: Permission class (`api/permissions.py`)

`has_permission()` runs during DRF's `initial()`. Checks scope strings (e.g., `org:read`, `project:write`). Does not check object-level access.

### Layer 3: convert_args() (`api/bases/*.py`)

Resolves URL kwargs (e.g., `organization_id_or_slug`) into model objects. Calls `check_object_permissions()` which triggers `has_object_permission()`.

### Layer 4: Access module (`auth/access.py`)

`determine_access()` is called from `convert_args()` in organization/project base endpoints. For org auth tokens, `from_rpc_auth()` compares `auth.organization_id` against the requested organization — returns `NoAccess()` on mismatch, which blocks all scope checks.

**Key functions:**

| Function             | File                        | What it checks                                           |
| -------------------- | --------------------------- | -------------------------------------------------------- |
| `from_rpc_auth()`    | `auth/access.py`            | Org auth token's `organization_id` matches requested org |
| `from_request()`     | `auth/access.py`            | Session-based access with org membership                 |
| `determine_access()` | `api/bases/organization.py` | Dispatches to the right access builder                   |

### Layer 5: Handler method

The endpoint's `get()`/`post()`/etc. May perform additional checks specific to the operation.

### Layer 6: Business logic classes

Classes like `Validator`, `ManualTokenRefresher`, `GrantExchanger`, and `Refresher` in `sentry_apps/token_exchange/` run their own validation before performing operations.

**Key class:** `Validator` (`sentry_apps/token_exchange/validator.py`) checks:

- User is a SentryApp proxy user
- App is owned by the requesting user
- `ApiApplication.is_active` (added in PR #105269)
- Installation matches the app

### Layer 7: Serializer

`validate_*()` methods and field-level validators may enforce org/project scoping on FK references.

## Tracing Requirements

Before marking a finding as **HIGH**, confirm the check is absent from **all** layers:

```
□ Authentication class does not enforce it
□ Permission class does not enforce it
□ convert_args() / has_object_permission() does not enforce it
□ Access module (from_rpc_auth / from_request) does not enforce it
□ Handler method does not enforce it
□ Business logic classes do not enforce it
□ Serializer does not enforce it
```

If the check exists in any layer, the finding is either invalid or at most **MEDIUM** (if the enforcement is indirect or fragile).
