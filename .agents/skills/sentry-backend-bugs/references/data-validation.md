# Data Validation and Input Handling

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

A broad and impactful category spanning **89 issues across ValueError, KeyError, data parsing, and assertion failures: 1,540,632 events, 10,927 affected users**. External input -- from webhook bodies, user parameters, stored data, and binary blobs -- is not validated before use. Includes field length violations, type coercion failures, missing dict keys, corrupt binary data, and violated invariants.

Sub-categories:

1. **Value validation (45 issues, 1,000,624 events)** -- ValueError from unpacking errors, invalid enum values, missing expected objects
2. **Data parsing (19 issues, 272,812 events)** -- JSONDecodeError, ZstdError from parsing external or stored data
3. **Missing key access (25 issues, 155,020 events)** -- KeyError from accessing dict keys or HTTP headers without checking existence
4. **Assertion failures (15 issues, 112,495 events)** -- AssertionError from bare asserts used as input validation

## Real Examples

### Example 1: Expected 1 sentry app installation (SENTRY-494A) -- resolved

**783,633 events | 0 users**

In-app frames:

```python
# sentry/notifications/notification_action/issue_alert_registry/handlers/sentry_app_issue_alert_handler.py
def get_target_identifier(self, action):
    installations = SentryAppInstallation.objects.filter(
        sentry_app__slug=action.target_identifier, ...
    )
    if installations.count() != 1:
        raise ValueError(
            f"Expected 1 sentry app installation for action type: sentry_app, "
            f"target_identifier: {action.target_identifier}"
        )  # CRASHES HERE
```

**Root cause:** Alert action builder assumes exactly 1 SentryAppInstallation exists for the target identifier. When the app is uninstalled or there are duplicates, this raises ValueError at massive scale because alert rules fire continuously.

**Fix:**

```python
installation = SentryAppInstallation.objects.filter(
    sentry_app__slug=action.target_identifier, ...
).first()
if installation is None:
    logger.warning("sentry_app.installation_not_found", ...)
    return None
```

**Actual fix:** Resolved -- lookup now handles missing and multiple installations gracefully.

### Example 2: Tuple unpacking failure on GitLab webhook (SENTRY-3VCS) -- ignored

**66,948 events | 64 users**

In-app frames:

```python
# sentry/integrations/gitlab/webhooks.py -- get_gitlab_external_id()
secret, group, _url = token.split(":")  # CRASHES: not enough values to unpack
```

**Root cause:** The GitLab token format is expected to be `secret:group:url`, but some tokens have fewer separators.

**Fix:**

```python
parts = token.split(":", 2)
if len(parts) != 3:
    raise ValueError(f"Invalid GitLab token format: expected 3 parts, got {len(parts)}")
secret, group, _url = parts
```

### Example 3: KeyError on GitLab/Bitbucket webhook headers (SENTRY-3VCC, SENTRY-3ZXH)

**65,805 combined events | 357 users**

In-app frames:

```python
# sentry/integrations/gitlab/webhooks.py
return request.META["HTTP_X_GITLAB_TOKEN"]  # CRASHES: KeyError

# sentry/integrations/bitbucket/webhook.py
event = request.META["HTTP_X_EVENT_KEY"]  # CRASHES: KeyError
```

**Root cause:** Webhook handlers use direct dict key access on `request.META` for HTTP headers. External services can send requests without the expected headers.

**Fix:**

```python
token = request.META.get("HTTP_X_GITLAB_TOKEN")
if token is None:
    return HttpResponse("Missing required header", status=400)
```

### Example 4: ZstdError on attachment decompression (SENTRY-5C5M) -- unresolved

**75,658 events | 3,834 users**

In-app frames:

```python
# sentry/api/endpoints/event_attachment_details.py -- stream_attachment()
data = zstd.decompress(raw_data)  # CRASHES: Unknown frame descriptor
```

**Root cause:** Stored attachment data is corrupted or was stored uncompressed but marked as compressed.

**Fix:**

```python
try:
    data = zstd.decompress(raw_data)
except zstd.ZstdError:
    logger.warning("attachment.decompress_failed", extra={"attachment_id": attachment.id})
    data = raw_data  # Fall back to raw data
```

### Example 5: JSONDecodeError on VSTS webhook body (SENTRY-5CKF) -- unresolved

**30,593 events | 11 users**

In-app frames:

```python
# sentry/middleware/integrations/parsers/vsts.py -- get_integration_from_request()
data = json.loads(request.body)  # CRASHES: unexpected end of data
```

**Root cause:** Azure DevOps (VSTS) sends webhook bodies that can be truncated. The JSON is valid but incomplete.

**Fix:**

```python
try:
    data = json.loads(request.body)
except (json.JSONDecodeError, ValueError):
    logger.warning("vsts.webhook.invalid_body", extra={"size": len(request.body)})
    return HttpResponse(status=400)
```

### Example 6: AssertionError in auth login (SENTRY-3VFR) -- resolved

**93,882 events | 158 users**

In-app frames:

```python
# sentry/web/frontend/auth_login.py -- post()
assert condition  # CRASHES -- assertion used as input validation
```

**Root cause:** Bare `assert` used for validation in the login flow. Assertions can be disabled with `python -O` and should not be used for input validation in production.

**Fix:**

```python
if not condition:
    messages.add_message(request, messages.ERROR, "Invalid request")
    return self.redirect(get_login_url())
```

**Actual fix:** Resolved -- assertions replaced with explicit validation.

### Example 7: Rule must belong to Project assertion (SENTRY-5EMS) -- resolved

**8,535 events | 0 users**

In-app frames:

```python
# sentry/digests/notifications.py -- build_digest()
for rule in rules:
    assert rule.project_id == project.id, "Rule must belong to Project"  # CRASHES
```

**Root cause:** Digest notification builder assumes all rules belong to the same project, but cross-project rule references can occur.

**Fix:**

```python
for rule in rules:
    if rule.project_id != project.id:
        logger.warning("digest.rule_project_mismatch", extra={...})
        continue
```

**Actual fix:** Resolved -- assertion replaced with graceful skip.

### Example 8: KeyError on unregistered GitLab event type (SENTRY-3ZWW) -- ignored

**45,235 events | 81 users**

In-app frames:

```python
# sentry/integrations/gitlab/webhooks.py -- post()
handler = HANDLERS[event_type]  # CRASHES: KeyError: 'Pipeline Hook'
```

**Root cause:** GitLab sends webhook events for event types (e.g., "Pipeline Hook") that are not in the `HANDLERS` dict. The code uses direct key access without checking existence.

**Fix:**

```python
handler = HANDLERS.get(event_type)
if handler is None:
    logger.info("gitlab.webhook.unhandled_event", extra={"event_type": event_type})
    return HttpResponse(status=204)  # Acknowledge but don't process
```

## Root Cause Analysis

| Pattern                                    | Frequency | Typical Source                                |
| ------------------------------------------ | --------- | --------------------------------------------- |
| Assuming exactly 1 DB result               | Very High | Deleted or duplicated objects                 |
| Missing HTTP headers in webhook handlers   | Very High | External services sending incomplete requests |
| Tuple unpacking on variable-format strings | High      | Token/config formats varying across versions  |
| Bare assert used as validation             | High      | Development checks left in production         |
| Corrupt binary data (zstd, zlib)           | High      | Truncated uploads, storage corruption         |
| JSON parsing without error handling        | High      | Truncated bodies, HTML error pages            |
| Unregistered dict keys                     | High      | New webhook events not in handler registry    |
| String exceeds CharField max_length        | Medium    | SDK-submitted data, user input                |
| Invalid enum/type conversions              | Medium    | User input or config values                   |

## Fix Patterns

### Pattern A: Safe header and dict access

```python
# Instead of:
token = request.META["HTTP_X_CUSTOM_HEADER"]
handler = HANDLERS[event_type]

# Use:
token = request.META.get("HTTP_X_CUSTOM_HEADER")
handler = HANDLERS.get(event_type)
```

### Pattern B: Safe tuple unpacking

```python
# Instead of:
a, b, c = value.split(":")

# Use:
parts = value.split(":", 2)
if len(parts) != 3:
    raise ValueError(f"Invalid format: expected 3 parts, got {len(parts)}")
a, b, c = parts
```

### Pattern C: Wrap all deserialization

```python
try:
    data = json.loads(body)
except (json.JSONDecodeError, ValueError):
    return HttpResponse("Invalid JSON", status=400)
```

### Pattern D: Replace assert with explicit validation

```python
# Instead of:
assert rule.project_id == project.id

# Use:
if rule.project_id != project.id:
    logger.warning("rule.project_mismatch", extra={"rule_id": rule.id})
    continue
```

### Pattern E: Validate binary data

```python
try:
    data = zstd.decompress(raw_data)
except zstd.ZstdError:
    data = raw_data  # Fall back
```

### Pattern F: Safe enum conversion

```python
try:
    level = DetectorPriorityLevel(value)
except ValueError:
    level = DetectorPriorityLevel.DEFAULT
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `request.META["HTTP_X_..."]` -- use `.get()` instead
- [ ] Any `dict[key]` lookup on handler registries or maps -- use `.get()` with fallback
- [ ] Any `a, b, c = value.split(...)` -- validate part count first
- [ ] Any bare `assert` statement -- replace with explicit validation and error handling
- [ ] Any `json.loads()` or `orjson.loads()` -- wrapped in try/except?
- [ ] Any `zstd.decompress()` or decompression -- handles corrupt data?
- [ ] Any `Model.objects.filter(...).count() != 1` followed by a raise -- handle 0 and >1 gracefully?
- [ ] Any `int()`, `float()`, `EnumClass()` on user input -- wrapped in try/except?
- [ ] Any webhook handler that accesses `request.body` -- handles empty/truncated bodies?
- [ ] Any `get_or_create()` -- are field values validated against max_length first?
