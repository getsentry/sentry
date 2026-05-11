# Integration and Webhook Handling Errors

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

**96 issues spanning SentryApp webhook errors (25 issues, 6.6M events) and API request errors (71 issues, 830K events), totaling 7,459,209 events, 8,724 affected users.** Integration webhooks, SentryApp callbacks, internal API requests, and external API interactions fail on unexpected payloads, missing state, or stale configuration. This is the highest-volume cluster because a single broken integration can generate millions of events from continuous alert rule firing.

Key sub-patterns:

1. **Missing service hook or installation** -- SentryApp uninstalled but webhooks still fire or alert rules still reference it
2. **Event not eligible for webhook** -- Webhook delivery attempted for events not in the service hook's event list
3. **Internal API errors from stale parameters** -- Internal API calls forwarding stale subscription queries that reference removed tags/metrics
4. **JSON decode on empty or truncated body** -- Integration partner sends empty body, HTML error page, or truncated JSON

## Real Examples

### Example 1: SentryAppSentryError event_not_in_servicehook (SENTRY-414F) -- resolved

**5,419,218 events | 0 users**

In-app frames:

```python
# sentry/sentry_apps/tasks/sentry_apps.py -- send_webhooks()
# Line 796: SentryAppSentryError: event_not_in_servicehook
```

**Root cause:** Workflow notification tasks attempt to send webhooks to SentryApps for event types that are not in the service hook's configured event list. The task checks the event type against the service hook's events but raises an error instead of silently skipping. At 5.4M events this is the single highest-volume code bug.

**Fix:**

```python
def send_webhooks(sentry_app, event, ...):
    servicehooks = ServiceHook.objects.filter(
        application_id=sentry_app.application_id,
    )
    for hook in servicehooks:
        if event_type not in hook.events:
            continue  # Skip -- this hook doesn't subscribe to this event type
        _deliver_webhook(hook, event, ...)
```

**Actual fix:** Resolved -- event eligibility check now skips instead of raising.

### Example 2: SentryAppSentryError missing_servicehook (SENTRY-41EN) -- resolved

**391,256 events | 0 users**

In-app frames:

```python
# sentry/sentry_apps/tasks/sentry_apps.py -- send_webhooks()
# Line 785: SentryAppSentryError: missing_servicehook
```

**Root cause:** A SentryApp was uninstalled (removing the ServiceHook), but existing alert rules still trigger webhook delivery tasks. The task cannot find the service hook and raises.

**Fix:**

```python
servicehook = ServiceHook.objects.filter(
    application_id=sentry_app.application_id,
    actor_id=sentry_app.proxy_user_id,
).first()
if servicehook is None:
    logger.info("sentry_app.webhook.missing_servicehook", extra={"sentry_app_id": sentry_app.id})
    return  # App was uninstalled, skip delivery
```

**Actual fix:** Resolved -- missing hook now results in a skip rather than an error.

### Example 3: Internal API error from stale metric subscription (SENTRY-55BH) -- ignored

**340,371 events | 0 users**

In-app frames:

```python
# sentry/incidents/charts.py -- fetch_metric_alert_events_timeseries()
response = client.get(url, params=params)  # ApiError: status=400
# body={'detail': ErrorDetail(string='transaction.duration is not a tag in the metrics dataset')}
```

Called from metric alert action triggers:

```python
# sentry/workflow_engine/tasks -- trigger_action()
chart_data = fetch_metric_alert_events_timeseries(...)  # Crashes
```

**Root cause:** A metric alert subscription references `transaction.duration` which is not a valid tag in the metrics dataset (it is a string type, not numeric). When the alert fires, the action tries to render a chart by querying the internal API with the same stale parameters. The internal API returns a 400 error that is not caught.

**Fix:**

```python
try:
    chart_data = fetch_metric_alert_events_timeseries(
        subscription_query=subscription.query, ...
    )
except ApiError as e:
    logger.warning(
        "incidents.charts.fetch_failed",
        extra={"subscription_id": subscription.id, "error": str(e)},
    )
    chart_data = None  # Proceed without chart
```

### Example 4: Internal API error from apdex threshold incompatibility (SENTRY-54VM) -- resolved

**65,927 events | 0 users**

Same pattern as above but for apdex queries:

```python
# sentry/incidents/charts.py -- fetch_metric_alert_events_timeseries()
# ApiError: status=400 body={'detail': 'Cannot query apdex with a threshold parameter on the metrics dataset'}
```

**Root cause:** Old alert rules created with the events dataset reference `apdex()` with threshold parameters. When these rules fire and the chart render uses the metrics dataset, the query is incompatible.

**Actual fix:** Resolved -- chart rendering now handles API errors gracefully.

## Root Cause Analysis

| Pattern                                | Frequency | Typical Source                                                            |
| -------------------------------------- | --------- | ------------------------------------------------------------------------- |
| Event not in service hook event list   | Very High | Workflow tasks sending webhooks for all events regardless of subscription |
| Missing service hook (app uninstalled) | Very High | Alert rules survive SentryApp uninstallation                              |
| Stale metric subscription parameters   | Very High | Dataset migration (events->metrics) leaving incompatible queries          |
| Internal API 400 errors not caught     | High      | Chart rendering in alert action triggers                                  |
| Empty webhook body                     | High      | MS Teams health pings, provider errors                                    |
| Truncated JSON payload                 | High      | VSTS large payloads, network timeouts                                     |
| HTML instead of JSON                   | Medium    | OAuth errors, rate limiting, captchas                                     |

## Fix Patterns

### Pattern A: Check event eligibility before webhook delivery

```python
def send_webhooks(sentry_app, event_type, ...):
    hooks = ServiceHook.objects.filter(application_id=sentry_app.application_id)
    for hook in hooks:
        if event_type not in hook.events:
            continue  # Not subscribed to this event type
        _deliver(hook, ...)
```

### Pattern B: Handle missing installations gracefully

```python
hook = ServiceHook.objects.filter(
    application_id=app.application_id,
    actor_id=app.proxy_user_id,
).first()
if hook is None:
    return  # App uninstalled
```

### Pattern C: Catch internal API errors in action triggers

```python
try:
    chart_data = fetch_metric_alert_events_timeseries(...)
except ApiError:
    chart_data = None  # Send alert without chart attachment
```

### Pattern D: Validate subscription query compatibility before use

```python
def validate_subscription_query(subscription):
    """Check if the subscription query is compatible with the current dataset."""
    try:
        build_query(subscription.query, dataset=subscription.dataset)
    except (IncompatibleMetricsQuery, InvalidSearchQuery):
        subscription.mark_invalid()
        return False
    return True
```

### Pattern E: Safe JSON parsing for webhooks

```python
def parse_webhook_body(request):
    if not request.body:
        return {}
    try:
        return orjson.loads(request.body)
    except orjson.JSONDecodeError:
        logger.warning("webhook.invalid_json", extra={"path": request.path})
        return None
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any SentryApp webhook delivery -- does it check event eligibility against the service hook's event list?
- [ ] Any ServiceHook or SentryAppInstallation lookup in webhook tasks -- is DoesNotExist handled?
- [ ] Any internal API call in metric alert action triggers -- is ApiError caught?
- [ ] Any `fetch_metric_alert_events_timeseries()` call -- does it handle 400 responses?
- [ ] Any `json.loads()` on `request.body` in webhook handlers -- is JSONDecodeError caught?
- [ ] Any external API response parsed as JSON -- is the status code and content-type checked?
- [ ] Any subscription query forwarded to internal API -- has compatibility been validated?
- [ ] Any alert rule referencing a SentryApp -- what happens when the app is uninstalled?
