# Outbox Backfill Reference

## Overview

When a model is migrated to use outboxes (or its replication logic changes), existing rows need outboxes created retroactively. The backfill system handles this incrementally, processing rows in batches with cursor position tracked in Redis and version gating controlled by the sentry options system.

**Source file**: `src/sentry/hybridcloud/tasks/backfill_outboxes.py`

## `replication_version` Mechanism

Every `RegionOutboxProducingModel` and `ControlOutboxProducingModel` has a class variable:

```python
replication_version: int = 1  # Default
```

Two systems work together to control backfills:

1. **Sentry options** — gate the effective replication version (controls _whether_ a backfill runs)
2. **Redis cursor** — track backfill progress as `(lower_bound_id, current_version)` (controls _where_ a backfill resumes)

### Version Resolution via Options

`find_replication_version()` determines the effective target version:

```python
def find_replication_version(model, force_synchronous=False) -> int:
    coded_version = model.replication_version
    if force_synchronous:
        return coded_version
    model_key = f"outbox_replication.{model._meta.db_table}.replication_version"
    return min(options.get(model_key), coded_version)
```

The effective version is `min(option_value, coded_version)`. This means:

- If the option is **not set or set lower** than the code, the backfill won't advance to the new version
- If the option is **set equal to or higher** than the code, the coded version is used
- If `force_synchronous=True` (self-hosted), the option is bypassed entirely

### Cursor Tracking via Redis

Redis tracks `(lower_bound_id, current_version)` per model table:

```python
# Key format:
f"outbox_backfill.{model._meta.db_table}"

# Value: JSON-encoded tuple of (lower_bound_id, current_version)
```

`_chunk_processing_batch()` compares the Redis cursor's `version` against the options-resolved `target_version`:

- If `version > target_version`: backfill already complete, skip
- If `version < target_version`: new version detected, reset cursor to 0 and start fresh
- If `version == target_version`: continue from where we left off

**To trigger a backfill**: Bump `replication_version` on the model class:

```python
class MyModel(ReplicatedRegionModel):
    replication_version = 2  # Was 1; bumping triggers backfill
```

## SaaS vs Self-Hosted Rollout

### SaaS (Gradual Rollout via Options)

The option key format is:

```python
f"outbox_replication.{model._meta.db_table}.replication_version"

# Example for OrganizationMember:
"outbox_replication.sentry_organizationmember.replication_version"
```

**Rollout procedure:**

1. Merge the code change with bumped `replication_version`
2. At this point, `min(option_value, coded_version)` still returns the old version — no backfill runs yet
3. Set the option to the new version value in the Sentry options system
4. Now `min(option_value, coded_version)` returns the new version — backfill starts on the next `enqueue_outbox_jobs` cycle
5. Monitor via Redis cursor state and task metrics

This two-step process allows deploying code first, then enabling the backfill separately — useful for coordinating with other changes or rolling back quickly by lowering the option.

### Self-Hosted (Synchronous)

On self-hosted instances, backfills run synchronously during `sentry upgrade` via the `run_outbox_replications_for_self_hosted` function (connected to the `post_upgrade` signal). This function:

1. Calls `backfill_outboxes_for(force_synchronous=True)` — bypasses options, uses `model.replication_version` directly
2. Drains all pending outbox shards
3. Ensures the instance is fully caught up after every upgrade

## Redis Cursor State Transitions

1. **Initial**: `(0, 1)` — no backfill has run (created on first `get_processing_state` call)
2. **In progress**: `(last_processed_id + 1, target_version)` — backfill is processing rows
3. **Complete**: `(0, replication_version + 1)` — all rows processed, version advanced past target
4. **New version detected**: cursor resets to `(0, new_target_version)` and starts from the beginning

## Batch Processing

```python
OUTBOX_BACKFILLS_PER_MINUTE = 10_000
```

Each batch (via `process_outbox_backfill_batch`):

1. Calls `_chunk_processing_batch` to determine the ID range `(low, up)` for this batch
2. For each instance in `model.objects.filter(id__gte=low, id__lte=up)`:
   - Region models: `inst.outbox_for_update().save()` inside `outbox_context(flush=False)`
   - Control models: saves all `inst.outboxes_for_update()` inside `outbox_context(flush=False)`
3. If no more rows: sets cursor to `(0, replication_version + 1)` (marks complete)
4. Otherwise: advances cursor to `(up + 1, version)`

Rate is limited by `OUTBOX_BACKFILLS_PER_MINUTE` adjusted by the count of already-scheduled outboxes. The `backfill_outboxes_for` function iterates all registered models and processes batches until the rate limit is reached.

## Monitoring a Backfill

### Check Redis Cursor State

```python
from sentry.hybridcloud.tasks.backfill_outboxes import get_processing_state

lower_bound, version = get_processing_state("sentry_mymodel")
# lower_bound > 0 means backfill is in progress
# version == model.replication_version + 1 means backfill is complete
```

### Check Option Value

```python
from sentry import options

# See what version the option is gating to:
options.get("outbox_replication.sentry_mymodel.replication_version")
```

### Check Outbox Queue Depth

```sql
-- Region outboxes for a specific category
SELECT count(*) FROM sentry_regionoutbox
WHERE category = <category_value>;

-- Top shards by depth
SELECT shard_scope, shard_identifier, count(*) as depth
FROM sentry_regionoutbox
GROUP BY shard_scope, shard_identifier
ORDER BY depth DESC
LIMIT 10;
```

### Metrics

- `backfill_outboxes.low_bound` — gauge of the current cursor position per table
- `backfill_outboxes.backfilled` — counter of rows backfilled per cycle
- `outbox.saved` — counter incremented each time an outbox is saved
- `outbox.processed` — counter incremented each time a coalesced outbox is processed
- `outbox.processing_lag` — histogram of time from outbox creation to processing
