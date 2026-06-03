# Design: Fan-out for `compare_snapshots` + stuck-PROCESSING recovery

Date: 2026-06-02
Status: Approved design (pre-implementation)
Area: `src/sentry/preprod/snapshots/`

## Problem

The preprod snapshot comparison task `compare_snapshots`
(`src/sentry/preprod/snapshots/tasks.py`) does the entire comparison in a single
task: load both manifests, categorize images, diff every eligible image pair
serially, then write the result. On very large builds (37k+ images) a single task
cannot win both budgets at once:

- **Memory**: too much work held in one process.
- **Deadline**: `processing_deadline_duration=300` is not enough for thousands of
  pixel diffs done serially.

A prior PR (#116712) tried to parallelize the odiff step with an in-process thread
pool (N `OdiffServer` workers). It was merged, OOM-hard-killed a worker mid-run,
froze a comparison in `PROCESSING` forever, and was reverted (`bce98e235ff`). Root
cause of the freeze: a hard kill (SIGKILL/OOM) bypasses the task's `except
BaseException` cleanup, so the row is never moved out of `PROCESSING`; and the
retry guard only re-runs `PENDING`/`FAILED` rows, so the broker's redelivery is
refused. The row stays stuck until the hourly reaper.

## Goal

Refactor `compare_snapshots` into a **fine-grained fan-out**: an orchestrator
splits the work into bounded chunks, each chunk is a separate serial task, and a
polling finalizer aggregates results. Every chunk is bounded by construction, so
no single task can exhaust memory or the deadline. Fold in **stuck-PROCESSING
recovery** (the original "Design A") as a natural property of the polling
finalizer rather than a separate mechanism.

## Non-goals

- Reviving the in-process thread pool, the `preprod.snapshots.odiff-worker-count`
  option, or the 300→600 deadline bump from the reverted PR. None of these come
  back.
- Changing the diff algorithm, odiff version, categorization, name-similarity
  matching, or the diff-mask / `comparison.json` objectstore layout.
- Removing the hourly reaper (`detect_expired_preprod_artifacts`). It stays as a
  last-resort backstop; the new poll is the primary recovery path.

## Verified platform constraints

These were verified against the installed `taskbroker_client` / `objectstore_client`
packages and drove the design:

1. **No chord/group/chain primitive.** Taskworker's dispatch API is only
   `delay()` / `apply_async()`. The "all chunks done → finalize" barrier must be
   built by us.
2. **`apply_async(countdown=...)` exists** and is the idiomatic way to build a
   self-rescheduling poll. Precedent: `src/sentry/relocation/tasks/process.py`
   (`validating_poll` re-fires with `countdown=60`, bounded by `MAX_VALIDATION_POLLS`).
3. **Broker is at-least-once.** A hard-killed task that never reports a result is
   redelivered after its processing deadline lapses. Whether that redelivery is
   bounded for a never-reporting task lives in the Rust broker and could not be
   confirmed — so we do **not** depend on it for recovery; we own recovery via a
   per-chunk `attempts` cap.
4. **Objectstore session has no `list`/`head`/`exists`** — only `put`/`get`/
   `delete`. Done-counting cannot enumerate result blobs; it must come from a
   queryable store (the DB).

## Architecture

Three roles replace the single task.

### 1. Orchestrator task (`compare_snapshots`, runs once)

Keeps all the cheap, low-memory setup the current task already does:

- Look up artifacts + metrics; create/lock the `PreprodSnapshotComparison` row
  (still created in `PROCESSING`).
- **Schedule the poll early** — immediately after the comparison row exists, via
  `apply_async(countdown=POLL_INTERVAL)`, _before_ the heavy setup below. This makes
  the poll a universal watchdog: if the orchestrator is hard-killed partway, the
  poll still fires and recovers it (see Polling finalizer + Orchestrator durability).
- Load both manifests from objectstore.
- `categorize_image_diff(...)` → added / removed / renamed / skipped + the
  matched pairs; select eligible pairs (hashes differ, under the 40M per-image
  cap).
- `_create_pixel_batches(eligible, MAX_PIXELS_PER_BATCH)` → batches.
  **1 chunk = 1 batch.** Chunks are sized by a **pixel budget**
  (`MAX_PIXELS_PER_BATCH = 40,000,000`), not a fixed image count — the number of
  image pairs per chunk floats with image size (~14 pairs on a typical mobile
  build; 1 pair for a single near-cap image; many for tiny images).

Then it persists the plan and dispatches:

- Write a **`plan.json`** blob to objectstore containing (a) each chunk's image
  assignment (chunk_index → list of candidates with names + hashes + pixel counts)
  and (b) the non-diff categories (added/removed/skipped/renamed). This makes the
  orchestrator's categorization deterministic, re-runnable, and readable by both
  chunk tasks and the finalizer.
- Create one `PreprodSnapshotComparisonChunk` row per chunk (upserted via
  `unique_together(comparison, chunk_index)` so an orchestrator re-run does not
  double-create).
- Dispatch one chunk task per chunk.
- **Set `comparison.chunks_total` last** (after `plan.json` + all chunk rows are
  written) as the atomic "orchestration complete" marker. A `NULL` `chunks_total`
  means orchestration did not finish.
- Return. The orchestrator does not wait. (The poll was already scheduled at the
  top.)

### 2. Chunk task (one per chunk, runs in parallel across the fleet)

Bounded by construction (one ~40M-px batch), so it finishes well under memory and
deadline budgets. For its slice only:

- Mark its chunk row `PROCESSING` (bumps `date_updated`, the heartbeat).
- Read its assignment from `plan.json`.
- Fetch its images, run odiff with a single `OdiffServer`, upload diff-mask PNGs
  (same keys as today), and write its per-image result slice as
  `chunks/{idx}.json` to objectstore.
- Mark its chunk row `DONE` (idempotent — a re-run just re-sets `DONE`).

The existing in-chunk image fetch keeps its bounded 8-worker
`ContextPropagatingThreadPoolExecutor` (`_fetch_batch_images`) — this is I/O
overlap on objectstore GETs for a handful of images, not the odiff parallelism
that caused the OOM (each chunk still has exactly one `OdiffServer`, serial). All
objectstore fetch/upload paths use the carried-forward `_retry_objectstore` helper
(retry once on 429/503), including the GET inside the fetch pool's worker.
Cross-chunk concurrency comes from the worker fleet, not from threads inside one
task.

### 3. Polling finalizer (self-rescheduling, universal watchdog)

On each wake, first checks for a terminal state, then branches on whether
orchestration has finished (`chunks_total IS NULL`?):

- **Comparison already `SUCCESS`/`FAILED`** → stop (idempotent exit; no reschedule).
- **Orchestration phase (`chunks_total IS NULL`)** — the orchestrator has not yet
  finished building the plan:
  - row stale (`date_updated` older than `CHUNK_STALE_THRESHOLD`) → the orchestrator
    likely died mid-setup → re-dispatch the orchestrator.
  - otherwise → reschedule the poll. _This is orchestrator-death recovery._
- **Chunk phase (`chunks_total` set)** — reads the cheap chunk rows for this
  comparison; `chunks_total` is the denominator:
  - **All chunks `DONE`** → read each chunk's `chunks/{idx}.json` slice + `plan.json`,
    merge into the final `ComparisonManifest` (`comparison.json`), write the rollup
    `images_*` counts, flip the comparison to `SUCCESS` via a guarded one-time state
    transition. Done.
  - **A not-done chunk looks dead** (`PROCESSING`/`PENDING` and `date_updated` older
    than `CHUNK_STALE_THRESHOLD`) **and `attempts < MAX_CHUNK_ATTEMPTS`** →
    re-dispatch that chunk, bump `attempts`. _This is chunk-death recovery._
  - **A dead chunk has `attempts >= MAX_CHUNK_ATTEMPTS`** → mark the chunk `FAILED`.
  - **Over the overall budget** (`COMPARISON_BUDGET`) → finalize with whatever is
    done (partial success; see Failure semantics).
  - **Otherwise** → reschedule the poll with `countdown=POLL_INTERVAL`.

The poll's denominator (`chunks_total`) is authoritative and written once, so it is
immune to the partial-chunk-row-creation race that counting rows would have.

## Data model

New Django model (cell silo, mirrors the existing comparison model's conventions):

```
PreprodSnapshotComparisonChunk
  comparison    FlexibleForeignKey -> PreprodSnapshotComparison (CASCADE)
  chunk_index   BoundedPositiveIntegerField
  state         BoundedPositiveIntegerField  # PENDING/PROCESSING/DONE/FAILED
  attempts      BoundedPositiveIntegerField (default 0)
  image_count   BoundedPositiveIntegerField (default 0)  # finalizer sanity-check
  date_added / date_updated  (DefaultFieldsModel; date_updated = heartbeat)
  unique_together(comparison, chunk_index)
```

Plus one new column on the existing `PreprodSnapshotComparison`:

```
chunks_total  BoundedPositiveIntegerField(null=True)
  # set once by the orchestrator as its atomic "orchestration complete" marker;
  # NULL = orchestration unfinished; also the poll's done-counting denominator.
  # Single-writer (orchestrator), like the existing images_* summary columns.
```

Requires a migration (`generate-migration`) covering both the new model and the
new column.

### Objectstore layout

Unchanged keys keep their current scheme; two new keys are added.

| Key                                   | Producer     | Notes                                            |
| ------------------------------------- | ------------ | ------------------------------------------------ |
| `.../{head}/{base}/diff/{stem}.png`   | chunk task   | diff masks (unchanged)                           |
| `.../{head}/{base}/comparison.json`   | finalizer    | final manifest (unchanged)                       |
| `.../{head}/{base}/plan.json`         | orchestrator | **new**: chunk assignments + non-diff categories |
| `.../{head}/{base}/chunks/{idx}.json` | chunk task   | **new**: per-chunk per-image result slice        |

## Cross-cutting properties

### Idempotency

- **Chunk tasks** write to deterministic keys (overwrite-safe) and set their own
  row `DONE`; a broker redelivery or poll re-dispatch just re-does the work
  harmlessly.
- **Orchestrator** upserts chunk rows and overwrites `plan.json` deterministically;
  a retry does not double-dispatch or duplicate rows.
- **Finalizer** flips `SUCCESS` via a guarded conditional UPDATE (same pattern as
  the existing retry guard), so it commits exactly once even if it runs twice.

### Stuck-recovery (Design A)

Recovery is the poll's job, not a separate reaper trip — and it covers **both** a
dead orchestrator and a dead chunk:

- **Dead orchestrator** (died before setting `chunks_total`): detected by the poll
  in its orchestration phase via stale `date_updated` while `chunks_total IS NULL`
  → re-dispatch the orchestrator (idempotent).
- **Dead chunk**: detected by the chunk row's stale `date_updated` → re-dispatch
  it, bounded by `attempts`.

No dependency on the hourly reaper or on unverified broker redelivery bounds. The
hourly reaper remains only as a final backstop.

### Failure semantics — partial success

A chunk that exhausts `MAX_CHUNK_ATTEMPTS` becomes `FAILED`. The finalizer:

- merges `DONE` chunks' result slices;
- for each `FAILED` chunk, marks that chunk's images (known from `plan.json`) as
  `errored`;
- still flips the comparison to `SUCCESS`, with the `errored` count reflecting the
  failed images.

This matches the current per-image degradation (a single failed image is already
`errored` without failing the whole comparison). The comparison only ends `FAILED`
if the **orchestrator** itself cannot build a plan (e.g. missing/invalid manifest)
— the existing early-failure paths are preserved.

### Determinism

Aggregation is order-independent: per-image results merge into a dict keyed by
image name and counts are summed, so chunk completion order does not matter. The
orchestrator's categorization is computed once and persisted in `plan.json`, so the
non-diff categories and chunk assignments are stable across retries.

### Concurrency & sizing of DB writes

`extras` (the only JSON field on `PreprodSnapshotComparison`) is **single-writer**:
only the finalizer writes it, once, at `SUCCESS` — the same `comparison_key` +
`diff_algorithm_version` the current code already persists. The orchestrator does
not write `extras` (the `plan.json` key is derivable from
`{org}/{project}/{head}/{base}`, like `comparison_key`), and chunk tasks never
touch the comparison row — each writes only its _own_ chunk row (one writer per
row, no contention) and its own uniquely-keyed objectstore blob. So the classic
JSON read-modify-write lost-update race never arises. The finalizer may _run_ more
than once (poll re-fire, or budget-then-all-done), but the `SUCCESS` flip is a
guarded one-time conditional UPDATE and the `extras` content is deterministic, so
re-runs are harmless.

Sizing: `extras` holds only a path string + an int (hundreds of bytes, unchanged
from today). Chunk rows hold only integers — no JSON. All large payloads (the
per-image plan and result slices, multi-MB at 37k images) go to objectstore
(`plan.json`, `chunks/{idx}.json`), never to Postgres — consistent with how
`comparison.json` and diff masks already live in objectstore. Net DB footprint per
row is smaller than the payload-in-DB alternative.

### Carry-forward

Re-add the ~12-line `_retry_objectstore` helper from the reverted PR (retry once on
429/503, fail fast on others) and apply it to the chunk task's image fetch, mask
upload, manifest loads, and the finalizer's reads/writes. Many concurrent chunks
make transient objectstore rate-limiting likelier.

## Tuning constants (initial values, revisit in implementation)

- `BATCHES_PER_CHUNK = 1` (1 chunk = 1 batch; chunk size governed by the existing
  `MAX_PIXELS_PER_BATCH = 40M` pixel budget).
- `POLL_INTERVAL` — poll cadence (target tens of seconds; bounded re-enqueue like
  relocation).
- `CHUNK_STALE_THRESHOLD` — how long a `PROCESSING`/`PENDING` chunk row may go
  without a heartbeat before the poll re-dispatches it (≈ a few × expected chunk
  duration).
- `MAX_CHUNK_ATTEMPTS` — re-dispatch cap before a chunk is permanently `FAILED`.
- `COMPARISON_BUDGET` — overall wall-clock budget before the finalizer gives up and
  partial-finalizes.

## Testing considerations

- Orchestrator: plan/chunk-row creation, idempotent re-run (no double-dispatch),
  early-failure paths preserved.
- Chunk task: processes its slice, idempotent re-run, `_retry_objectstore`
  behavior on 429/503 vs fail-fast on 404.
- Finalizer: all-done aggregation, order-independent merge, partial success with a
  `FAILED` chunk's images marked `errored`, exactly-once `SUCCESS` flip, stale-chunk
  re-dispatch, overall-budget partial finalize.
- End-to-end: a build large enough to produce multiple chunks; a simulated
  hard-killed chunk recovered by the poll.

## Open implementation details (resolve during planning)

- Exact chunk-task signature / how the assignment index is passed (task arg vs read
  from `plan.json` by index).
- Whether the orchestrator stays named `compare_snapshots` (preserving the existing
  enqueue call sites) with chunk task + poll task as new task names in the same
  namespace.
- Final numeric values for the tuning constants above.

(Resolved during brainstorming: poll-as-universal-watchdog with a `chunks_total`
completion-marker column handles orchestrator durability; `chunks_total` is the
poll denominator; the in-chunk 8-worker fetch pool is retained with
`_retry_objectstore` wrapping its GET.)
