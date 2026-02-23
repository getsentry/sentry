# Missing Records and Stale References

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

The most impactful code-level bug category in the Sentry backend: **81 issues, 1,403,592 events, 10,727 affected users**. The pattern is consistent -- code calls `.get()` on a Django model assuming the record exists, but it has been deleted, merged, or never created.

The most common sources of stale IDs:

1. **Snuba/ClickHouse query results** -- Snuba stores issue IDs, project IDs, and group IDs that may be deleted from Postgres before Snuba data expires
2. **Workflow engine references** -- Detectors, subscriptions, and alert rules reference objects deleted asynchronously
3. **Integration state** -- SentryAppInstallation, ServiceHook, or ExternalActor deleted while alert rules still reference them
4. **Cross-silo references** -- Region silo holds IDs that reference control silo objects (or vice versa) that may be deleted asynchronously
5. **Cached foreign keys** -- A ProjectKey cached in Redis still references a `project_id` for a deleted project
6. **Monitor/cron references** -- Environment objects referenced by monitors that may be deleted

## Real Examples

### Example 1: Detector.DoesNotExist in workflow engine (SENTRY-5D9J) -- resolved

**610,142 events | 0 users**

In-app frames:

```python
# sentry/workflow_engine/processors/detector.py -- _get_detector_for_event()
def _get_detector_for_event(event_data):
    detector_id = event_data.get("detector_id")
    try:
        return Detector.objects.get(id=detector_id)  # CRASHES HERE
    except Detector.DoesNotExist:
        raise  # Re-raises without handling
```

**Root cause:** Workflow events reference detector IDs that have been deleted. The `process_workflows_event` task receives events from a queue with detector IDs, but detectors can be deleted between event creation and processing.

**Fix pattern:**

```python
detector = Detector.objects.filter(id=detector_id).first()
if detector is None:
    logger.warning("detector.not_found", extra={"detector_id": detector_id})
    return  # Skip processing for deleted detectors
```

**Actual fix:** Resolved -- detector lookup now handles the DoesNotExist case gracefully.

### Example 2: Environment.DoesNotExist in monitor consumer (SENTRY-3VDX) -- resolved

**146,432 events | 0 users**

In-app frames:

```python
# sentry/monitors/models.py -- get_environment()
def get_environment(self):
    return Environment.objects.get(id=self.environment_id)  # CRASHES HERE
```

Called from:

```python
# sentry/monitors/logic/incident_occurrence.py -- send_incident_occurrence()
environment = monitor.get_environment()
```

**Root cause:** The monitor checkin references an environment that has been deleted. The `Environment.objects.get()` call has no `DoesNotExist` handler.

**Fix pattern:**

```python
def get_environment(self):
    try:
        return Environment.objects.get(id=self.environment_id)
    except Environment.DoesNotExist:
        return None
```

**Actual fix:** Resolved -- environment lookup now returns None for deleted environments.

### Example 3: Subscription.DoesNotExist in billing tasks (SENTRY-4DEQ) -- resolved

**72,700 events | 0 users**

In-app frames:

```python
# getsentry/billing/tasks/usagebuffer.py -- flush_usage_buffer()
subscription = Subscription.objects.get(id=subscription_id)  # CRASHES HERE
```

**Root cause:** Billing usage buffer tasks reference subscription IDs that have been cancelled/deleted between task scheduling and execution.

**Fix pattern:**

```python
try:
    subscription = Subscription.objects.get(id=subscription_id)
except Subscription.DoesNotExist:
    logger.info("subscription.not_found", extra={"subscription_id": subscription_id})
    return  # Nothing to flush for a deleted subscription
```

**Actual fix:** Resolved -- task now handles missing subscriptions gracefully.

## Root Cause Analysis

| Pattern                                         | Frequency | Typical Source                                  |
| ----------------------------------------------- | --------- | ----------------------------------------------- |
| Workflow engine detector/rule deleted           | Very High | `Detector.objects.get(id=event.detector_id)`    |
| Snuba ID references deleted Postgres record     | High      | `Group.objects.get(id=event["issue.id"])`       |
| Billing/subscription object deleted             | High      | `Subscription.objects.get(id=sub_id)`           |
| Environment deleted while monitors reference it | High      | `Environment.objects.get(id=monitor.env_id)`    |
| Integration uninstalled while rules active      | High      | Alert rules referencing deleted SentryApp       |
| Cached FK target deleted                        | Medium    | `get_from_cache(id=fk_id)` after parent deleted |
| Cross-silo object deleted asynchronously        | Medium    | Region silo references control silo object      |

## Fix Patterns

### Pattern A: Graceful skip for async task processing

When a celery task or consumer processes an event referencing an object by ID, handle the case where the object was deleted between event creation and processing.

```python
def process_workflow_event(event_data):
    detector = Detector.objects.filter(id=event_data["detector_id"]).first()
    if detector is None:
        logger.info("detector.deleted", extra={"detector_id": event_data["detector_id"]})
        return
    # proceed with detector
```

### Pattern B: Filter query instead of get

When you need a single object that might not exist, use `.filter().first()` instead of `.get()`.

```python
# Instead of:
project = Project.objects.get(id=key.project_id)

# Use:
project = Project.objects.filter(id=key.project_id).first()
if project is None:
    return handle_missing_project()
```

### Pattern C: Batch lookups with graceful skip

When processing a list of items, prefetch and skip missing records instead of crashing the entire batch.

```python
# Instead of:
for event in events:
    group = Group.objects.get(id=event["issue.id"])  # Crashes on missing

# Use:
group_ids = [e["issue.id"] for e in events]
groups = {g.id: g for g in Group.objects.filter(id__in=group_ids)}
for event in events:
    group = groups.get(event["issue.id"])
    if group is None:
        continue
    process(group)
```

### Pattern D: Cascade cleanup on deletion

When deleting a parent object, ensure downstream references are cleaned up.

```python
# When deleting an environment:
Environment.objects.filter(id=env_id).delete()
# Also update monitors that reference this environment
Monitor.objects.filter(environment_id=env_id).update(environment_id=None)
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `.get()` call on a Django model manager -- does it have a `DoesNotExist` handler?
- [ ] Any `.get_from_cache()` call -- does it handle the case where the cached FK target is deleted?
- [ ] Any code that uses IDs from Snuba, Redis, Kafka, or task queues to look up Postgres records
- [ ] Any code in workflow engine that looks up Detectors, AlertRuleWorkflows, or Subscriptions by ID
- [ ] Any code in monitor/cron consumers that looks up Environments or MonitorCheckIns
- [ ] Any code in billing tasks that looks up Subscriptions by ID
- [ ] Chained lookups: first `.get()` succeeds, second `.get()` on a related object fails
- [ ] Batch serialization code that calls `.get()` in a loop without try/except
