# Issue Action Log & Derived Data

## Concepts

### The Action Log

`IssueActionLog` is a sequential, immutable, factual record of actions taken on issues. Each entry records who did what, when, with a validated payload. The log is append-only — entries are never modified or reordered.

The log is a general-purpose foundation. Anything with read access can maintain a cursor into the log and process entries incrementally, the same way a Kafka consumer works over a topic.

### Deriving state from the log

We have a mechanism for deriving a current state from the log:

- **Fields** are typed state data — named slots with defaults that hold the derived values (e.g., `last_seen`, `status`, `working_on`).
- **Aggregators** are hierarchical folds over the log. Each aggregator declares which fields it reads (deps) and writes (outputs), processes one entry at a time, and produces state updates. The framework enforces isolation: an aggregator can only access its declared fields.
- A **Pipeline** (naming to be reconsidered) is a versioned set of fields and aggregators. It validates the dependency graph at construction time, topologically sorts, and processes entries in the correct order.

### Storage

`GroupDerivedData` is the initial storage backend for a pipeline's derived state. It stores one JSON blob per (group, pipeline version) pair in Postgres, aimed to be efficient and useful enough to incorporate in existing Group usage patterns (e.g., filtering, annotation via JOIN).

It is not the only possible backend. The pipeline's output is a plain dict that could be written to Redis, a separate service, or materialized into dedicated columns elsewhere.

## Status of current actions and aggregators

The existing Action types, Fields, and Aggregators in this codebase are **examples for demonstration and experimentation**. They exercise the system's capabilities (scope filtering, dependency chains, Pydantic codecs, cross-field logic like `was_autofixed`) but are not expected to be the canonical set that ships. The framework and infrastructure are the point; the specific derived attributes will be driven by product requirements.

## Architecture

```
record() → IssueActionLog (append-only)
                ↓
        process (inline batch + background task fallback)
                ↓
        Pipeline (aggregators in dependency order)
                ↓
        GroupDerivedData (one JSON blob per group+version, primary flag)
                ↓
        ORM queries: Group.objects.filter(groupderiveddata__primary=True, groupderiveddata__data__field=value)
```

## Key Concepts in Detail

### Actions and Recording

`IssueActionType`, `Action`, and `record()` are all in `recording.py` — see the docstrings there for the full API. Key design decisions not obvious from the code:

- **No DB constraint on type values** — avoids migration churn when adding types. The constraint is at the `record()` boundary: it only accepts `Action` subclasses, each mapping to exactly one `IssueActionType`.
- **Enum values must never be reused** — gaps are fine, but a value once assigned to an action kind is permanent.
- **The Action is the sole source of the data schema** — `record()` has no backdoor for injecting unvalidated data. Everything in `IssueActionLog.data` comes from the Action's pydantic fields.
- **`record()` processes inline** — writes the log entry, then runs a small batch of derived-data processing synchronously. Falls back to a background task if there's a backlog.
- **Actor attribution** uses `user_id` (nullable for system-initiated actions). Future: likely `actor_type` enum + `actor_id` for richer attribution (Sentry system actions, Seer on behalf of a user, external integrations).

There is a debug-only batch POST endpoint at `/api/0/organizations/{org}/issue-action-log-debug/` for development testing. In production, events are recorded by internal code paths calling `record()` directly.

### Fields

A `Field` is a named, typed slot in the derived state with a default value. Fields are the atoms of state that aggregators compose.

```python
LAST_SEEN = Field[float | None]("last_seen", default=None)
STATUS = Field[str]("status", default=IssueStatus.OPEN)
WORKING_ON = Field[dict[str, WorkingOnEntry]]("working_on", default_factory=dict, codec=PydanticDictCodec(WorkingOnEntry))
```

Fields with JSON-native values (str, int, float, bool, list, dict) need no codec. Fields with rich types (e.g., `dict[str, PydanticModel]`) use a `Codec` for serialization. `PydanticDictCodec(Model)` handles the common `dict[str, SomeModel]` pattern.

### Aggregators

An aggregator is a function decorated with `@aggregator` that declares:

- **`outputs`**: fields it writes (must be unique across all aggregators)
- **`deps`**: fields it reads that are produced by other aggregators
- **`scope`** (optional): which `IssueActionType` values it runs on (accepts enum members)

```python
@aggregator(outputs=(LAST_SEEN, VIEW_COUNT), scope=(IssueActionType.VIEW,))
def track_views(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    ts = entry.date_added.timestamp()
    current = state[LAST_SEEN]
    if current is None or ts > current:
        return emit(LAST_SEEN.value(ts), VIEW_COUNT.value(state[VIEW_COUNT] + 1))
    return emit(VIEW_COUNT.value(state[VIEW_COUNT] + 1))
```

Aggregators receive a `StateView` restricted to their declared deps and outputs — accessing undeclared fields raises `KeyError`. Return `emit(FIELD.value(x), ...)` to update fields, or `None` to make no change.

Aggregators must be **pure folds**: the state at cursor N must fully capture everything needed from entries 1..N. This is the contract that makes truncation, snapshotting, and reprocessing safe.

### Pipeline

A `Pipeline` is a versioned set of aggregators. At construction time it:

1. Validates no duplicate outputs
2. Validates all deps are satisfied
3. Detects cycles
4. Topologically sorts so deps run before dependents

```python
pipeline = Pipeline(AGGREGATORS, version=1)
```

The version identifies this pipeline definition. When aggregator logic changes, bump it. Different versions coexist independently in storage.

### Processing

`record()` processes inline (small batch, synchronous) and falls back to a background task if there's a backlog. `process_group_log()` fully drains all pending entries (used by the task).

Each call writes to the `GroupDerivedData` row for the pipeline's version. The conditional update (`WHERE cursor <= new_cursor AND version = V`) ensures concurrent or duplicate processing never regresses the stored state.

### Versioning

The version is a property of the `Pipeline` — it's the pipeline definition that determines what "version" means. `GroupDerivedData` has one row per (group, version) pair.

The `primary` flag on `GroupDerivedData` marks which row readers should use. Writers control when to flip this. Readers just filter `primary=True` — they never need to reason about versions.

**Current policy** (single-version): `process_group_log` marks its row as primary immediately and demotes any other primary row for that group.

**Multi-version lifecycle** (documented, not yet automated):

1. Old pipeline (version N) is primary and continues processing
2. New pipeline (version N+1) is deployed with `primary=False`. It creates fresh rows from cursor=0
3. A backfill job reprocesses all groups at version N+1
4. Once a group's N+1 row catches up, `promote_primary(group_id, version)` flips primary to the new row
5. Version-N rows are eligible for cleanup

`process_group_log` accepts a `target_pipeline` parameter for running a non-default pipeline version. `promote_primary()` in `processing.py` handles the primary flip.

### Querying

Query via Group JOIN to derived data, filtering on the primary row:

```python
Group.objects.filter(
    groupderiveddata__primary=True,
    groupderiveddata__data__was_autofixed=True,
    project__organization_id=org.id,
)
```

Readers always filter `primary=True` — no need to know the current version. This uses the `(group, primary)` index for the join, then Postgres JSON operators for the data filter.

## How To

### Add a new action type

1. Add the enum value to `IssueActionType` in `recording.py`
2. Add a frozen Pydantic `Action` subclass with `get_type()` and payload fields
3. Add the action name → class mapping in `ACTION_CLASSES` in `organization_issue_action_log_debug.py`

### Add a new derived field

1. Declare the `Field` in `fields.py` with a default and optional `Codec`
2. Write an aggregator in `aggregators.py` with `@aggregator(outputs=(YOUR_FIELD,), ...)`
3. Add the aggregator to the `AGGREGATORS` list
4. Add tests

### Add an aggregator with dependencies

Use `deps=` to declare fields your aggregator reads from other aggregators:

```python
@aggregator(deps=(STATUS, LAST_OPENED), outputs=(MY_FIELD,))
def compute_my_field(state: StateView, entry: IssueActionLog) -> AggregatorResult:
    if state[STATUS] == IssueStatus.OPEN:
        return emit(MY_FIELD.value(...))
    return None
```

The pipeline topologically sorts so dependencies run first. Cycles are detected at construction time.

### Change aggregator logic (bump version)

1. Modify aggregators in `aggregators.py`
2. Increment the `version` on the `Pipeline(...)` constructor in `processing.py`
3. New processing calls will create version-N rows. Old rows are untouched.
4. To reprocess existing groups, schedule `process_group_log` for each group (it will create a fresh row at the new version from cursor=0).
5. Queries don't change — they filter `primary=True`, and processing handles the primary flag.

## Design Properties

- **Sequential, immutable log**: IssueActionLog is append-only. Entries are never modified or reordered.
- **Aggregators are pure folds**: The state at cursor N fully captures entries 1..N. This makes truncation, snapshotting, and reprocessing safe.
- **Versioned pipelines**: Pipeline changes bump the version. Old and new version rows coexist. Readers filter `primary=True`; writers control the primary flag.
- **Inline + async processing**: `record()` processes synchronously when possible (small batch), falls back to a background task for backlogs.
- **Batched + checkpointed**: Processing runs in configurable batches with DB checkpoints between. Safe to interrupt.
- **Concurrent-safe**: Conditional update (`cursor <= new_cursor`, scoped to version) prevents regression. Duplicate processing is harmless.
- **Aggregator isolation**: Each aggregator can only access its declared deps/outputs via `StateView`. Undeclared access raises `KeyError`, undeclared writes raise `ValueError`.
- **Backend-agnostic derivation**: The pipeline outputs a plain dict. `GroupDerivedData` in Postgres is the current backend, chosen for its ability to integrate with existing Group query patterns.
- **Pure Python core**: `lib.py` has no Django dependencies. Fields, State, and Pipeline are fully testable in isolation.

## Planned: Log Truncation & Snapshots

The IssueActionLog is append-only and grows without bound. Truncation deletes old entries while preserving the ability to recompute derived data from scratch.

### Core idea

Because aggregators are pure folds, the derived state at cursor N is a complete summary of entries 1..N. A **snapshot** captures this state so that the entries it summarizes can be safely deleted. If GroupDerivedData is ever lost or suspect, processing loads the snapshot as initial state and replays from the snapshot's cursor forward.

### Planned model: GroupActionLogSnapshot

```
group_id            FK to Group
cursor              The IssueActionLog.id this snapshot summarizes through
pipeline_version    Which pipeline produced this snapshot
data                JSON — the serialized state at that cursor
date_added          When the snapshot was created
```

One snapshot per (group, pipeline_version). The snapshot is on the **log side**, not the derived-data side — it must survive independently of GroupDerivedData because the point is that GroupDerivedData can be thrown away and rebuilt.

### Planned functions

- **`create_snapshot(group_id, at_cursor, version)`** — processes entries up to `at_cursor` (or uses existing derived data if its cursor ≥ `at_cursor`) and stores the result as a snapshot.

- **`truncate_group_log(group_id, before_cursor, force=False)`** — deletes IssueActionLog entries with `id < before_cursor`. Safety check: refuses unless a snapshot exists at or past `before_cursor` for all active pipeline versions (determined from code config, not per-row state). `force=True` skips the check.

- **Update to `process_group_log`** — when starting from cursor=0, check for a snapshot and load it as initial state instead of field defaults. Entries before the snapshot's cursor are skipped (they may not exist).

### Truncation workflow (operational)

1. Identify groups with large logs (e.g., `IssueActionLog.objects.filter(group_id=X).count()`)
2. Pick a truncation point (e.g., `IssueActionLog.objects.filter(group_id=X, date_added__lt=cutoff).order_by("-id").first().id`)
3. `create_snapshot(group_id, at_cursor=truncation_point, version=pipeline.version)`
4. `truncate_group_log(group_id, before_cursor=truncation_point)`
5. GroupDerivedData is unaffected — it already has state past the truncation point

### Reprocessing after truncation

If GroupDerivedData is deleted (or a new pipeline version starts from cursor=0):

1. `process_group_log` finds cursor=0, looks for a snapshot
2. Loads the snapshot's data as initial state, sets cursor to the snapshot's cursor
3. Processes remaining entries from there
4. Result is identical to processing the full untruncated log

### Version retirement

Which pipeline versions are "active" is determined by code config (the set of Pipeline instances in use), not per-row state. When retiring a version:

1. Ensure the replacement version is caught up and primary
2. Optionally keep the old version's snapshot as a safety net (compare results, rollback)
3. Delete the old version's GroupDerivedData row
4. The old version's snapshot can be kept or deleted depending on whether you want the ability to resurrect it

### Not planned yet

- Bulk truncation task across many groups
- Cold archival of truncated entries
- Automatic snapshot creation (currently operator-triggered)
- Automatic version retirement policy

## TODO

- **Feature flag gating** — gate `record()` behind an `organizations:issue-action-log` flag before wiring into production paths
- **More realistic action events** — the current actions are demonstrative; define the canonical set based on product requirements
- **Actions derived from existing Activity types** — dual-write from Activity to IssueActionLog for action types that map to existing ActivityType values, keeping existing consumers working during transition
- **Richer actor model** — `actor_type` enum + `actor_id` to support Sentry system actions, Seer on behalf of a user, external integrations
- **Consider retroactive events** — we may learn about events from 3rd parties slightly after the fact (e.g., a PR merge notification arrives after the merge happened). Currently entries are ordered by insertion (auto-increment id), not by when the action occurred. If retroactive events matter, aggregators may need to handle out-of-order `date_added` values, or we need a mechanism to insert at the correct logical position.
- **Multi-version pipeline transitions** — automate the lifecycle (backfill, promote, retire)
- **Log truncation & snapshots** — implement the planned model above
