# Debugging Stuck Outboxes

## Processing Pipeline

Understanding the pipeline helps locate where things break:

1. **Model save/delete** writes outbox row inside `outbox_context(transaction.atomic(...))`
2. **On commit**: if `flush=True`, `drain_shard()` runs synchronously for that shard
3. **Periodic task**: `enqueue_outbox_jobs` (region) / `enqueue_outbox_jobs_control` (control) runs on a cron schedule
4. **`schedule_batch`** partitions the ID range into `CONCURRENCY=5` chunks and spawns `drain_outbox_shards` tasks
5. **`drain_outbox_shards`** calls `process_outbox_batch` which:
   - Calls `find_scheduled_shards(lo, hi)` to find shards with `scheduled_for <= now`
   - Calls `prepare_next_from_shard(shard)` to lock the first message and bump backoff
   - Calls `shard_outbox.drain_shard(flush_all=True)` to process the shard
6. **`drain_shard`** loops: `process_shard()` (lock) -> `process()` -> `process_coalesced()` -> `send_signal()`
7. **Signal receiver** fires for the `OutboxCategory`, executing the handler logic (RPC calls, tombstones, etc.)
8. **On success**: coalesced outbox rows are deleted in batches of 50

## Backoff Schedule

When processing fails, `prepare_next_from_shard` bumps `scheduled_for` using exponential backoff:

```
Attempt 1: now + 2 * last_delay  (initial delay ~seconds)
Attempt 2: now + 4 * last_delay
Attempt 3: now + 8 * last_delay
...
Maximum: 1 hour between retries
```

The backoff is computed as:

```python
def next_schedule(self, now):
    return now + min((self.last_delay() * 2), datetime.timedelta(hours=1))
```

Where `last_delay()` is `scheduled_for - scheduled_from` (time since last attempt).

## Constructing Diagnostic SQL Queries

When debugging stuck outboxes, you'll often need to generate SQL for a developer to run against production PostgreSQL. Follow these rules to construct the correct query.

### Choosing the Correct Table

| Direction            | Model class     | Table name             |
| -------------------- | --------------- | ---------------------- |
| Region -> Control    | `RegionOutbox`  | `sentry_regionoutbox`  |
| Control -> Region(s) | `ControlOutbox` | `sentry_controloutbox` |

**How to determine direction**: Look at the model that changed.

- If the source model is decorated `@region_silo_model` (or inherits `ReplicatedRegionModel`), it writes to `sentry_regionoutbox`
- If the source model is decorated `@control_silo_model` (or inherits `ReplicatedControlModel`), it writes to `sentry_controloutbox`

### Column Reference

Both tables share these columns:

| Column              | Type        | Description                                  |
| ------------------- | ----------- | -------------------------------------------- |
| `id`                | bigint      | Auto-increment primary key                   |
| `shard_scope`       | int         | `OutboxScope` enum value (see `category.py`) |
| `shard_identifier`  | bigint      | Shard key (e.g., org ID, user ID)            |
| `category`          | int         | `OutboxCategory` enum value                  |
| `object_identifier` | bigint      | ID of the source model instance              |
| `payload`           | jsonb       | Optional JSON data (nullable)                |
| `scheduled_from`    | timestamptz | When this attempt started                    |
| `scheduled_for`     | timestamptz | When eligible for next processing            |
| `date_added`        | timestamptz | When the outbox was created                  |

`sentry_controloutbox` has one additional column:

| Column        | Type    | Description                   |
| ------------- | ------- | ----------------------------- |
| `region_name` | varchar | Target region for this outbox |

### Resolving Enum Values

Before constructing a query, resolve the integer values for the category and scope from `src/sentry/hybridcloud/outbox/category.py`. Read the file to get the exact values. For example:

- `OutboxCategory.ORGANIZATION_MEMBER_UPDATE` = 3
- `OutboxScope.ORGANIZATION_SCOPE` = 0

**Always include the resolved enum names as SQL comments** so the developer knows what the magic numbers mean.

### Query Templates

When generating SQL for a developer, **print the query to the terminal** so they can copy-paste it into a production psql session. Always include:

1. A comment header explaining what the query does
2. Comments mapping integer values to their enum names
3. Reasonable `LIMIT` clauses to avoid overwhelming output

#### Find stuck shards (region)

```sql
-- Find region outbox shards stuck in backoff
-- shard_scope: 0 = ORGANIZATION_SCOPE, 1 = USER_SCOPE, etc.
-- category: see OutboxCategory enum in category.py
SELECT
    shard_scope,
    shard_identifier,
    category,
    count(*) AS depth,
    min(scheduled_for) AS next_attempt,
    min(date_added) AS oldest_message,
    max(date_added) AS newest_message
FROM sentry_regionoutbox
WHERE scheduled_for > NOW()
GROUP BY shard_scope, shard_identifier, category
ORDER BY depth DESC
LIMIT 20;
```

#### Find stuck shards (control)

```sql
-- Find control outbox shards stuck in backoff
SELECT
    region_name,
    shard_scope,
    shard_identifier,
    category,
    count(*) AS depth,
    min(scheduled_for) AS next_attempt
FROM sentry_controloutbox
WHERE scheduled_for > NOW()
GROUP BY region_name, shard_scope, shard_identifier, category
ORDER BY depth DESC
LIMIT 20;
```

#### Inspect a specific shard

```sql
-- Inspect messages in a specific shard (most recent first)
-- Replace <scope>, <shard_id> with actual values
SELECT
    id,
    category,
    object_identifier,
    payload,
    scheduled_from,
    scheduled_for,
    date_added
FROM sentry_regionoutbox
WHERE shard_scope = <scope>  -- e.g., 0 = ORGANIZATION_SCOPE
  AND shard_identifier = <shard_id>  -- e.g., the organization_id
ORDER BY id DESC
LIMIT 50;
```

#### Check depth for a specific category

```sql
-- Count pending outboxes for a specific category
-- category: <N> = <CATEGORY_NAME>
SELECT count(*) AS pending
FROM sentry_regionoutbox
WHERE category = <N>;
```

#### Find outboxes for a specific object

```sql
-- Find all outboxes for a specific model instance
-- category: <N> = <CATEGORY_NAME>
SELECT
    id,
    shard_scope,
    shard_identifier,
    payload,
    scheduled_from,
    scheduled_for,
    date_added
FROM sentry_regionoutbox
WHERE category = <N>
  AND object_identifier = <object_id>
ORDER BY id DESC
LIMIT 20;
```

#### Top shards by depth (overall health check)

```sql
-- Top 10 deepest shards across all scopes/categories
SELECT
    shard_scope,
    shard_identifier,
    count(*) AS depth
FROM sentry_regionoutbox
GROUP BY shard_scope, shard_identifier
ORDER BY depth DESC
LIMIT 10;
```

### Agent Instructions for SQL Generation

When a developer asks you to debug stuck outboxes:

1. **Determine the table**: Ask which model or direction is involved, or infer from context. Use `sentry_regionoutbox` for region models, `sentry_controloutbox` for control models.
2. **Resolve enum values**: Read `src/sentry/hybridcloud/outbox/category.py` to get the integer values for the relevant `OutboxCategory` and `OutboxScope`.
3. **Construct the query**: Use the templates above, substituting resolved values. Always add comments with the human-readable enum names.
4. **Print to terminal**: Output the final SQL so the developer can copy it. Do NOT attempt to run it — you don't have production database access.
5. **Explain what to look for**: Tell the developer what the results mean (e.g., "if `scheduled_for` is far in the future, the shard is in exponential backoff after repeated failures").

## Kill Switches

### Disable Specific Shards

The `should_skip_shard()` method checks these options:

```python
# Skip specific organization shards (region outboxes)
"hybrid_cloud.authentication.disabled_organization_shards": [org_id_1, org_id_2]

# Skip specific user shards (region/control outboxes)
"hybrid_cloud.authentication.disabled_user_shards": [user_id_1, user_id_2]
```

When a shard is skipped, its outboxes remain in the table but are not processed until the option is removed.

### Disable Backfills

Set the option value lower than the code's `replication_version` to prevent a backfill from running:

```python
# If model.replication_version = 3, setting this to 2 prevents the v3 backfill:
"outbox_replication.sentry_mymodel.replication_version": 2
```

See `references/backfill.md` for details on how `find_replication_version()` uses `min(option_value, coded_version)`.

## Useful Metrics

| Metric                                 | Type      | Description                             |
| -------------------------------------- | --------- | --------------------------------------- |
| `outbox.saved`                         | counter   | Outbox rows saved (per category tag)    |
| `outbox.processed`                     | counter   | Coalesced outbox groups processed       |
| `outbox.processing_lag`                | histogram | Time from `date_added` to processing    |
| `outbox.coalesced_net_processing_time` | histogram | Time spent in `send_signal()`           |
| `outbox.coalesced_net_queue_time`      | histogram | Total queue time for coalesced messages |
| `schedule_batch.queued_batch_size`     | gauge     | Number of drain tasks spawned per cycle |
| `schedule_batch.maximum_shard_depth`   | gauge     | Deepest shard in the current batch      |
| `schedule_batch.total_outbox_count`    | gauge     | Total pending outbox count              |

## Check Shard Depths Programmatically

For local debugging or in a Django shell:

```python
from sentry.hybridcloud.models.outbox import RegionOutbox, ControlOutbox

# Top 10 deepest region shards
for shard in RegionOutbox.get_shard_depths_descending(limit=10):
    print(f"Scope={shard['shard_scope']} ID={shard['shard_identifier']} Depth={shard['depth']}")
```

## Common Debugging Scenarios

### Outbox Rows Accumulating But Not Processing

1. Check if `enqueue_outbox_jobs` task is running (Taskbroker / cron)
2. Check if `drain_outbox_shards` tasks are being spawned (check Taskbroker queue)
3. Check if specific shards are disabled via kill switches
4. Check if all shards are in backoff (`scheduled_for > now()`)
5. Check if the signal handler is crashing or raising any exceptions

### Handler Raising Exceptions

1. In tests: `OutboxFlushError` wraps the original exception with the outbox details
2. In production: errors are captured to Sentry — search for the outbox category name
3. Check the signal receiver code for the `OutboxCategory` value in the stuck outbox

### Data Replicated But Stale

1. Outboxes are coalesced — intermediate updates are skipped
2. Check that the handler reads from the DB (not the payload) for current data
3. If using `payload_for_update()`, ensure the payload contains only immutable or slowly-changing data

### Test Outbox Issues

- **`OutboxFlushError`**: The signal receiver raised an exception during `outbox_runner()`. Read the nested exception.
- **`OutboxRecursionLimitError`**: More than 10 drain iterations — likely an outbox handler that creates more outboxes in an infinite loop.
- **Outbox not created**: Ensure the model inherits from the right mixin and the manager is a producing manager. Raw `QuerySet.update()` / `QuerySet.delete()` bypass outbox creation.
