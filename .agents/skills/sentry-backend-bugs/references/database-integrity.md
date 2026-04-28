# Database Integrity Violations

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

**31 issues (22 constraint violations + 9 duplicate object collisions), 2,972,784 events, 940 affected users.** Race conditions between concurrent requests cause duplicate key violations, foreign key violations during cleanup, integer overflow on counter fields, and `MultipleObjectsReturned` from `get()` calls where uniqueness assumptions are violated.

Three main sub-patterns:

1. **DataError from integer overflow** -- Counter fields like `times_seen` overflow the 32-bit integer range (~2.1 billion)
2. **IntegrityError from FK violations** -- Bulk deletion of parent records while child records still reference them
3. **MultipleObjectsReturned** -- `get()` assumes exactly one match, but data has duplicates

## Real Examples

### Example 1: Integer out of range on times_seen counter (SENTRY-4E5F) -- resolved

**1,753,743 events | 0 users**

In-app frames:

```python
# sentry/db/models/query.py -- update()
# SQL: UPDATE "sentry_groupedmessage" SET "times_seen" = ("sentry_groupedmessage"."times_seen" + 1)
# DataError: integer out of range
```

Called from:

```python
# sentry/buffer/base.py -- process()
Group.objects.filter(id=group_id).update(times_seen=F("times_seen") + count)
```

**Root cause:** The `times_seen` field on `Group` is a standard 32-bit integer. For very active groups, the counter exceeds 2,147,483,647 and the Postgres `UPDATE` fails with `DataError: integer out of range`.

**Fix:**

```python
# Cap the increment to prevent overflow
from django.db.models import F, Value
from django.db.models.functions import Least

Group.objects.filter(id=group_id).update(
    times_seen=Least(F("times_seen") + count, Value(2_147_483_647))
)
```

**Actual fix:** Resolved -- either the field was migrated to BigInteger or the increment is now capped.

### Example 2: FK violation during MonitorCheckIn cleanup (SENTRY-5DCR) -- resolved

**187,518 events | 0 users**

In-app frames:

```python
# sentry/utils/query.py -- bulk_delete_objects()
# IntegrityError: update or delete on table "sentry_monitorcheckin" violates
# foreign key constraint "sentry_monitorincide_..." on table "sentry_monitorincident"
```

Called from:

```python
# sentry/runner/commands/cleanup.py -- multiprocess_worker()
bulk_delete_objects(MonitorCheckIn, ...)
```

**Root cause:** The cleanup task bulk-deletes old `MonitorCheckIn` records, but `MonitorIncident` records still reference them via a foreign key. The deletion does not check for or cascade child references.

**Fix:**

```python
# Delete child references first, or use CASCADE
MonitorIncident.objects.filter(
    checkin_id__in=checkin_ids_to_delete
).update(checkin_id=None)  # Or delete incidents first
bulk_delete_objects(MonitorCheckIn, ...)
```

**Actual fix:** Resolved -- cleanup now handles FK constraints before deletion.

### Example 3: Date range lower bound exceeds upper bound (SENTRY-4EDG) -- ignored

**753,527 events | 0 users**

In-app frames:

```python
# sentry/models/groupopenperiod.py -- close_open_period()
# DataError: range lower bound must be less than or equal to range upper bound
# SQL: UPDATE "sentry_groupopenperiod" SET ...
```

**Root cause:** The `GroupOpenPeriod` model uses a date range field. When closing an open period, the end timestamp can be earlier than the start timestamp due to clock skew or race conditions in the event pipeline.

**Fix:**

```python
def close_open_period(self, end_time):
    if end_time < self.start_time:
        end_time = self.start_time  # Clamp to valid range
    self.date_range = DateTimeTZRange(self.start_time, end_time)
    self.save()
```

### Example 4: MultipleObjectsReturned on Repository (SENTRY-3W17) -- unresolved

**2,391 events | 3 users**

In-app frames:

```python
# sentry_plugins/heroku/plugin.py -- set_refs()
repo = Repository.objects.get(
    name=repo_name, organization_id=org_id
)  # Repository.MultipleObjectsReturned!
```

**Root cause:** The `(name, organization_id)` combination is not unique at the database level (or became non-unique through a migration gap). The code uses `get()` which raises when more than one match exists.

**Fix:**

```python
repo = Repository.objects.filter(
    name=repo_name, organization_id=org_id,
).order_by("-date_added").first()
if repo is None:
    raise Repository.DoesNotExist()
```

### Example 5: SentryAppInstallation.MultipleObjectsReturned (SENTRY-5HSD) -- resolved

**2,554 events | 305 users**

In-app frames:

```python
# sentry/sentry_apps/services/app/impl.py -- find_installation_by_proxy_user()
installation = SentryAppInstallation.objects.get(
    sentry_app=sentry_app, ...
)  # MultipleObjectsReturned: get() returned more than one -- it returned 4!
```

**Root cause:** A SentryApp can have multiple installations (e.g., installed, uninstalled, re-installed) and the query does not filter by status.

**Fix:**

```python
installation = SentryAppInstallation.objects.filter(
    sentry_app=sentry_app,
    status=SentryAppInstallationStatus.INSTALLED,
    ...
).first()
```

**Actual fix:** Resolved -- query now filters by status and uses `.first()`.

### Example 6: ExternalActor.MultipleObjectsReturned in notifications (SENTRY-43YW) -- resolved

**2,250 events | 0 users**

In-app frames:

```python
# sentry/integrations/notifications.py -- _get_channel_and_integration_by_team()
actor = ExternalActor.objects.get(
    team_id=team_id, integration_id=integration_id, ...
)  # MultipleObjectsReturned!
```

**Root cause:** An ExternalActor (Slack channel mapping for a team) was duplicated, likely through a data migration or re-linking.

**Fix:**

```python
actor = ExternalActor.objects.filter(
    team_id=team_id, integration_id=integration_id, ...
).first()
```

**Actual fix:** Resolved -- uses `.first()` instead of `.get()`.

## Root Cause Analysis

| Pattern                                | Frequency | Typical Trigger                               |
| -------------------------------------- | --------- | --------------------------------------------- |
| Integer field overflow on counters     | Very High | `times_seen` incrementing past 2^31           |
| FK violation during bulk deletion      | High      | Cleanup tasks deleting parent without cascade |
| Date range bound inversion             | High      | Clock skew in distributed event pipeline      |
| get() on non-unique data               | High      | Missing DB unique constraint, data duplicates |
| Concurrent insert on unique constraint | Medium    | Consumers processing same message             |
| get_or_create() race                   | Medium    | Two threads call get_or_create simultaneously |

## Fix Patterns

### Pattern A: Cap integer fields before update

```python
from django.db.models import F, Value
from django.db.models.functions import Least

Model.objects.filter(id=pk).update(
    counter=Least(F("counter") + increment, Value(2_147_483_647))
)
```

### Pattern B: Handle FK constraints in bulk deletion

```python
# Delete or nullify child references first
ChildModel.objects.filter(parent_id__in=ids_to_delete).delete()
# Then delete parents
ParentModel.objects.filter(id__in=ids_to_delete).delete()
```

### Pattern C: Validate range bounds

```python
if end_time < start_time:
    end_time = start_time  # or raise ValueError
```

### Pattern D: filter().first() instead of get()

```python
# Instead of:
obj = Model.objects.get(name=name, org=org)

# Use:
obj = Model.objects.filter(name=name, org=org).order_by("-date_added").first()
if obj is None:
    raise Model.DoesNotExist()
```

### Pattern E: Insert-or-fetch for concurrent inserts

```python
from django.db import IntegrityError

try:
    obj = Model.objects.create(**fields)
except IntegrityError:
    obj = Model.objects.get(**unique_fields)
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `F("field") + increment` on integer fields -- can the field overflow 2^31?
- [ ] Any bulk deletion (`bulk_delete_objects`, `queryset.delete()`) -- are there FK constraints on child tables?
- [ ] Any date range field updates -- can lower bound exceed upper bound?
- [ ] Any `.get()` call -- is `MultipleObjectsReturned` possible? Check if the filter fields are actually unique at DB level
- [ ] Any `.save()` on a model with unique constraints -- is `IntegrityError` handled?
- [ ] Any `get_or_create()` in concurrent context -- wrapped in try/except `IntegrityError`?
- [ ] Any consumer/worker code processing messages -- can the same message be processed concurrently?
