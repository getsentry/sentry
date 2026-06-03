# Snapshot Comparison Fan-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `compare_snapshots` from one monolithic task into a fan-out (orchestrator → bounded serial chunk-tasks → polling finalizer) so 37k-image builds finish within memory and deadline budgets, and fold in stuck-PROCESSING recovery.

**Architecture:** An orchestrator does the cheap setup (manifest load, categorization, batch planning), persists a `plan.json` to objectstore, creates one `PreprodSnapshotComparisonChunk` row per chunk, dispatches a chunk-task each, and records `chunks_total`. Each chunk-task processes one ~40M-pixel batch serially with a single `OdiffServer`, uploads diff masks, and writes its result slice to objectstore. A self-rescheduling poll task is the universal watchdog: it recovers a dead orchestrator (`chunks_total IS NULL` + stale) or dead chunks (stale chunk rows), and when all chunks are `DONE` it merges the slices into the final `comparison.json` and flips the comparison to `SUCCESS` (partial success if some chunks permanently failed).

**Tech Stack:** Django (Postgres), Sentry taskworker (`@instrumented_task`, `Retry`, `apply_async(countdown=...)`), Pydantic v1 manifests, objectstore (`objectstore_client.Session`), odiff (`OdiffServer`).

**Spec:** `docs/superpowers/specs/2026-06-02-snapshot-comparison-fanout-design.md`

**Reference (verbatim current code, line numbers):** all paths under `/Users/nicolashinderling/dev/sentry`.

---

## File structure

- **Modify** `src/sentry/preprod/snapshots/models.py` — add `PreprodSnapshotComparisonChunk` model + `chunks_total` column on `PreprodSnapshotComparison`.
- **Create** `src/sentry/preprod/migrations/0029_add_snapshot_comparison_chunk.py` — migration for the model + column (auto-generated).
- **Modify** `src/sentry/preprod/snapshots/manifest.py` — add `ChunkCandidate`, `ChunkAssignment`, `ComparisonPlan`, `ChunkResult` Pydantic schemas.
- **Modify** `src/sentry/preprod/snapshots/tasks.py` — re-add `_retry_objectstore`; add constants; extract `_build_comparison_plan`, `_process_chunk`, `_finalize_comparison`; split the task into `compare_snapshots` (orchestrator), `process_snapshot_comparison_chunk` (chunk), `poll_snapshot_comparison` (watchdog/finalizer).
- **Create** `tests/sentry/preprod/snapshots/test_compare_snapshots.py` — orchestrator, chunk, poll, and end-to-end tests.
- **Modify** `tests/sentry/preprod/snapshots/test_tasks.py` — add `_build_comparison_plan` unit tests (lives next to the existing `categorize_image_diff` tests).

## Tuning constants (initial values; add near the top of `tasks.py` with the existing `MAX_*` constants)

```python
CHUNK_PROCESSING_DEADLINE = 120  # seconds; one ~40M-px batch finishes well under this
POLL_INTERVAL = 30  # seconds between poll wakes
CHUNK_STALE_THRESHOLD = 300  # seconds without a heartbeat before a chunk/orchestrator is "dead"
MAX_CHUNK_ATTEMPTS = 3  # re-dispatches before a chunk is permanently FAILED
COMPARISON_BUDGET = 1500  # seconds (wall-clock from date_added) before partial-finalize
```

---

## Task 1: Add the chunk model + `chunks_total` column

**Files:**

- Modify: `src/sentry/preprod/snapshots/models.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/sentry/preprod/snapshots/test_compare_snapshots.py`:

```python
from __future__ import annotations

from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotComparisonChunk,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


@cell_silo_test
class PreprodSnapshotComparisonChunkModelTest(TestCase):
    def _comparison(self) -> PreprodSnapshotComparison:
        artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(artifact)
        base_artifact = self.create_preprod_artifact(project=self.project)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        return self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head,
            base_snapshot_metrics=base,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )

    def test_chunk_defaults_and_uniqueness(self):
        comparison = self._comparison()
        chunk = PreprodSnapshotComparisonChunk.objects.create(comparison=comparison, chunk_index=0)
        assert chunk.state == PreprodSnapshotComparisonChunk.State.PENDING
        assert chunk.attempts == 0
        assert chunk.image_count == 0

    def test_chunks_total_nullable_default(self):
        comparison = self._comparison()
        assert comparison.chunks_total is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::PreprodSnapshotComparisonChunkModelTest -p no:randomly`
Expected: FAIL with `ImportError: cannot import name 'PreprodSnapshotComparisonChunk'`.

- [ ] **Step 3: Add the column + model**

In `src/sentry/preprod/snapshots/models.py`, add the `chunks_total` field to `PreprodSnapshotComparison` (right after `images_skipped`, before `extras`):

```python
    images_skipped = BoundedPositiveIntegerField(default=0, db_default=0)

    # Set once by the orchestrator after the plan + all chunk rows are written.
    # NULL means orchestration did not finish; also the poll's done-counting denominator.
    chunks_total = BoundedPositiveIntegerField(null=True)
```

Then append a new model at the end of the file:

```python
@cell_silo_model
class PreprodSnapshotComparisonChunk(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    class State(IntEnum):
        PENDING = 0
        PROCESSING = 1
        DONE = 2
        FAILED = 3

        @classmethod
        def as_choices(cls) -> tuple[tuple[int, str], ...]:
            return (
                (cls.PENDING, "pending"),
                (cls.PROCESSING, "processing"),
                (cls.DONE, "done"),
                (cls.FAILED, "failed"),
            )

    comparison = FlexibleForeignKey(
        "preprod.PreprodSnapshotComparison",
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = BoundedPositiveIntegerField()
    state = BoundedPositiveIntegerField(default=State.PENDING, choices=State.as_choices())
    attempts = BoundedPositiveIntegerField(default=0)
    image_count = BoundedPositiveIntegerField(default=0)

    class Meta:
        app_label = "preprod"
        db_table = "sentry_preprodsnapshotcomparisonchunk"
        unique_together = ("comparison", "chunk_index")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::PreprodSnapshotComparisonChunkModelTest -p no:randomly`
Expected: PASS (uses `--reuse-db`; if it errors about a missing table/column, that's expected until Task 2 creates the migration — run Task 2 then re-run).

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/models.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "feat(preprod): Add PreprodSnapshotComparisonChunk model and chunks_total"
```

---

## Task 2: Generate the migration

**Files:**

- Create: `src/sentry/preprod/migrations/0029_add_snapshot_comparison_chunk.py`

The preprod app has its own migrations dir; latest is `0028_add_images_skipped_to_snapshot_comparison.py`.

- [ ] **Step 1: Generate the migration**

Run: `cd /Users/nicolashinderling/dev/sentry && sentry django makemigrations preprod -n add_snapshot_comparison_chunk`
Expected: creates `src/sentry/preprod/migrations/0029_add_snapshot_comparison_chunk.py` with a `CreateModel("PreprodSnapshotComparisonChunk", ...)` and an `AddField("preprodsnapshotcomparison", "chunks_total", ...)`.

- [ ] **Step 2: Verify the migration header**

Open the generated file. Confirm:

- `class Migration(CheckedMigration)` and `is_post_deployment = False`.
- `dependencies = [("preprod", "0028_add_images_skipped_to_snapshot_comparison")]`.
- `import sentry.db.models.fields.bounded` and `...foreignkey` are present.

- [ ] **Step 3: Apply and verify**

Run: `cd /Users/nicolashinderling/dev/sentry && sentry django migrate preprod`
Expected: applies `0029` cleanly.

- [ ] **Step 4: Re-run the Task 1 test against the real schema**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::PreprodSnapshotComparisonChunkModelTest -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/migrations/0029_add_snapshot_comparison_chunk.py
git commit -m "feat(preprod): Migration for snapshot comparison chunks"
```

---

## Task 3: Add plan/result Pydantic schemas

**Files:**

- Modify: `src/sentry/preprod/snapshots/manifest.py`
- Test: `tests/sentry/preprod/snapshots/test_manifest.py`

These schemas serialize `plan.json` (orchestrator output) and `chunks/{idx}.json` (chunk output). `ComparisonImageResult` already exists in this file (lines 62–76).

- [ ] **Step 1: Write the failing test**

Append to `tests/sentry/preprod/snapshots/test_manifest.py`:

```python
def test_comparison_plan_round_trip():
    from sentry.preprod.snapshots.manifest import (
        ChunkAssignment,
        ChunkCandidate,
        ComparisonImageResult,
        ComparisonPlan,
    )

    plan = ComparisonPlan(
        head_artifact_id=1,
        base_artifact_id=2,
        chunks=[
            ChunkAssignment(
                chunk_index=0,
                candidates=[ChunkCandidate(name="a.png", head_hash="h", base_hash="b", pixel_count=10)],
            )
        ],
        non_diff_images={"x.png": ComparisonImageResult(status="added")},
    )
    restored = ComparisonPlan(**plan.dict())
    assert restored.chunks[0].candidates[0].name == "a.png"
    assert restored.non_diff_images["x.png"].status == "added"


def test_chunk_result_round_trip():
    from sentry.preprod.snapshots.manifest import ChunkResult, ComparisonImageResult

    result = ChunkResult(chunk_index=3, images={"a.png": ComparisonImageResult(status="changed")})
    restored = ChunkResult(**result.dict())
    assert restored.chunk_index == 3
    assert restored.images["a.png"].status == "changed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_manifest.py -k "comparison_plan or chunk_result" -p no:randomly`
Expected: FAIL with `ImportError: cannot import name 'ComparisonPlan'`.

- [ ] **Step 3: Add the schemas**

In `src/sentry/preprod/snapshots/manifest.py`, after the existing `ComparisonManifest` class, add:

```python
class ChunkCandidate(BaseModel):
    name: str
    head_hash: str
    base_hash: str
    pixel_count: int


class ChunkAssignment(BaseModel):
    chunk_index: int
    candidates: list[ChunkCandidate]


class ComparisonPlan(BaseModel):
    head_artifact_id: int
    base_artifact_id: int
    chunks: list[ChunkAssignment]
    # Results that need no odiff (added/removed/skipped/renamed/unchanged/exceeds-pixel-limit).
    non_diff_images: dict[str, ComparisonImageResult]


class ChunkResult(BaseModel):
    chunk_index: int
    images: dict[str, ComparisonImageResult]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_manifest.py -k "comparison_plan or chunk_result" -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/manifest.py tests/sentry/preprod/snapshots/test_manifest.py
git commit -m "feat(preprod): Add plan and chunk-result manifest schemas"
```

---

## Task 4: Re-add `_retry_objectstore` and wrap objectstore calls

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py`

This is the helper from the reverted PR (#116712), parallelism-independent and more relevant under fan-out.

- [ ] **Step 1: Write the failing test**

Append to `tests/sentry/preprod/snapshots/test_compare_snapshots.py`:

```python
from unittest.mock import MagicMock

import pytest
from objectstore_client.client import RequestError

from sentry.preprod.snapshots.tasks import _retry_objectstore


def test_retry_objectstore_retries_once_on_429():
    calls = {"n": 0}

    def op():
        calls["n"] += 1
        if calls["n"] == 1:
            raise RequestError(429, "rate limited")
        return "ok"

    assert _retry_objectstore(op) == "ok"
    assert calls["n"] == 2


def test_retry_objectstore_fails_fast_on_404():
    def op():
        raise RequestError(404, "missing")

    with pytest.raises(RequestError):
        _retry_objectstore(op)


def test_retry_objectstore_gives_up_after_max_attempts():
    def op():
        raise RequestError(503, "unavailable")

    with pytest.raises(RequestError):
        _retry_objectstore(op)
```

Note: confirm the `RequestError(status, response)` constructor signature from `objectstore_client/client.py:38`; adjust the test instantiation if it differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_compare_snapshots.py -k retry_objectstore -p no:randomly`
Expected: FAIL with `ImportError: cannot import name '_retry_objectstore'`.

- [ ] **Step 3: Add the helper + imports**

In `src/sentry/preprod/snapshots/tasks.py`, add `import time` and `from collections.abc import Callable` (or `from typing import Callable`) to the imports, then add near the top-level constants:

```python
# Concurrent batch fetches/uploads make transient objectstore 429/503s likelier. Retry once
# (more would just amplify rate limiting); other errors (e.g. 404) fail fast.
_RETRYABLE_OBJECTSTORE_STATUSES = frozenset({429, 503})
_OBJECTSTORE_MAX_ATTEMPTS = 2
_OBJECTSTORE_RETRY_DELAY_S = 0.5


def _retry_objectstore[T](operation: Callable[[], T]) -> T:
    for attempt in range(1, _OBJECTSTORE_MAX_ATTEMPTS + 1):
        try:
            return operation()
        except RequestError as e:
            if (
                e.status not in _RETRYABLE_OBJECTSTORE_STATUSES
                or attempt == _OBJECTSTORE_MAX_ATTEMPTS
            ):
                raise
            time.sleep(_OBJECTSTORE_RETRY_DELAY_S)
    raise AssertionError("unreachable")
```

`RequestError` is already imported (`tasks.py:12`).

- [ ] **Step 4: Wrap the existing objectstore calls**

Wrap each objectstore `get`/`put` in `_retry_objectstore(lambda: ...)`:

- The per-image `session.get(...).payload.read()` inside `_fetch_batch_images` (`tasks.py:162-183`, the threadpool worker).
- Both manifest loads in the orchestrator (currently `tasks.py:472-494`).
- The diff-mask `session.put(...)` (`tasks.py:673`).
- The final `comparison.json` `session.put(...)` (`tasks.py:766-771`).

Example for a get: `payload = _retry_objectstore(lambda: session.get(key).payload.read())`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_compare_snapshots.py -k retry_objectstore -p no:randomly`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "feat(preprod): Re-add _retry_objectstore for transient 429/503"
```

---

## Task 5: Extract `_build_comparison_plan`

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_tasks.py`

Pull the orchestrator's planning logic (everything between manifest load and the odiff loop) into a pure function so it's unit-testable and reusable by the orchestrator. This is the existing logic at `tasks.py:504-578` (categorize → matched/unchanged/eligible split, lines 521-560) plus the non-matched category building (`tasks.py:724-754`) — **but producing `ComparisonImageResult`/`ChunkAssignment` objects instead of mutating an `image_results` dict in place.**

- [ ] **Step 1: Write the failing test**

Append to `tests/sentry/preprod/snapshots/test_tasks.py`:

```python
def test_build_comparison_plan_splits_diff_and_non_diff():
    from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
    from sentry.preprod.snapshots.tasks import _build_comparison_plan

    head = SnapshotManifest(
        images={
            "changed.png": ImageMetadata(content_hash="h1", width=100, height=100),
            "same.png": ImageMetadata(content_hash="sameh", width=10, height=10),
            "new.png": ImageMetadata(content_hash="n1", width=10, height=10),
        },
        diff_threshold=None,
    )
    base = SnapshotManifest(
        images={
            "changed.png": ImageMetadata(content_hash="h0", width=100, height=100),
            "same.png": ImageMetadata(content_hash="sameh", width=10, height=10),
            "gone.png": ImageMetadata(content_hash="g0", width=10, height=10),
        },
        diff_threshold=None,
    )

    plan = _build_comparison_plan(head, base, head_artifact_id=1, base_artifact_id=2)

    diff_names = {c.name for chunk in plan.chunks for c in chunk.candidates}
    assert diff_names == {"changed.png"}  # only hash-differing matched pair needs odiff
    assert plan.non_diff_images["same.png"].status == "unchanged"
    assert plan.non_diff_images["new.png"].status == "added"
    assert plan.non_diff_images["gone.png"].status == "removed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_tasks.py -k build_comparison_plan -p no:randomly`
Expected: FAIL with `ImportError: cannot import name '_build_comparison_plan'`.

- [ ] **Step 3: Implement `_build_comparison_plan`**

Add to `tasks.py`. It calls the existing `categorize_image_diff`, the existing matched/unchanged/eligible logic (relocated from `tasks.py:521-560`), the existing `_create_pixel_batches`, and the existing non-matched category logic (relocated from `tasks.py:724-754`), returning a `ComparisonPlan`:

```python
def _build_comparison_plan(
    head_manifest: SnapshotManifest,
    base_manifest: SnapshotManifest,
    head_artifact_id: int,
    base_artifact_id: int,
) -> ComparisonPlan:
    diff = categorize_image_diff(head_manifest, base_manifest)
    non_diff_images: dict[str, ComparisonImageResult] = {}
    eligible: list[_DiffCandidate] = []

    # Matched images: unchanged (hashes equal), exceeds-pixel-limit (errored), else eligible.
    # Relocate the per-name logic currently at tasks.py:521-560, but instead of appending to
    # image_results, write unchanged/errored entries into non_diff_images and eligible diffs
    # into `eligible`. Build ComparisonImageResult(status="unchanged"/"errored", ...) exactly
    # as the current code populates image_results[name].
    ...

    # Non-matched: added / removed / skipped / renamed (relocate tasks.py:724-754, writing
    # ComparisonImageResult entries into non_diff_images instead of image_results).
    ...

    batches = _create_pixel_batches(eligible, MAX_PIXELS_PER_BATCH)
    chunks = [
        ChunkAssignment(
            chunk_index=i,
            candidates=[
                ChunkCandidate(
                    name=c.name, head_hash=c.head_hash, base_hash=c.base_hash, pixel_count=c.pixel_count
                )
                for c in batch
            ],
        )
        for i, batch in enumerate(batches)
    ]
    return ComparisonPlan(
        head_artifact_id=head_artifact_id,
        base_artifact_id=base_artifact_id,
        chunks=chunks,
        non_diff_images=non_diff_images,
    )
```

Add imports: `from sentry.preprod.snapshots.manifest import (ChunkAssignment, ChunkCandidate, ComparisonImageResult, ComparisonPlan, ...)` to the existing manifest import block.

> Implementation note: the relocated matched/non-matched blocks are existing, working code — move them verbatim, changing only the _sink_ (write to `non_diff_images` / `eligible` instead of `image_results`). Do not re-derive the categorization logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv tests/sentry/preprod/snapshots/test_tasks.py -k build_comparison_plan -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_tasks.py
git commit -m "ref(preprod): Extract _build_comparison_plan for fan-out"
```

---

## Task 6: Refactor `compare_snapshots` into the orchestrator

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py`

The orchestrator keeps the existing setup (artifact/metrics lookup `tasks.py:352-389`, comparison create/lock + retry-guard `tasks.py:391-445`, VCS start signal `tasks.py:447-451`, manifest load `tasks.py:472-494`). It then: schedules the poll early, builds the plan, writes `plan.json`, creates chunk rows, dispatches chunk tasks, sets `chunks_total`. The odiff loop and finalization are removed (they move to Tasks 7–8).

- [ ] **Step 1: Write the failing test**

Append to `tests/sentry/preprod/snapshots/test_compare_snapshots.py` (use the `_mock_session_with_manifests` pattern from `test_auto_approve.py:117-129`; mock `get_preprod_session` and the dispatch helpers):

```python
from unittest.mock import patch

import orjson

from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.models import (
    PreprodSnapshotComparison,
    PreprodSnapshotComparisonChunk,
    PreprodSnapshotMetrics,
)


@cell_silo_test
class CompareSnapshotsOrchestratorTest(TestCase):
    def _setup(self):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        head.extras = {"manifest_key": "head_manifest"}
        head.save()
        base = self.create_preprod_snapshot_metrics(base_artifact)
        base.extras = {"manifest_key": "base_manifest"}
        base.save()
        return head_artifact, base_artifact

    def test_orchestrator_creates_chunks_and_sets_total(self):
        head_artifact, base_artifact = self._setup()
        head_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h1", width=100, height=100)},
            diff_threshold=None,
        )
        base_manifest = SnapshotManifest(
            images={"changed.png": ImageMetadata(content_hash="h0", width=100, height=100)},
            diff_threshold=None,
        )
        session = _mock_session_with_manifests(
            {
                "head_manifest": orjson.dumps(head_manifest.dict()),
                "base_manifest": orjson.dumps(base_manifest.dict()),
            }
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async") as dispatch,
            patch("sentry.preprod.snapshots.tasks.poll_snapshot_comparison.apply_async") as poll,
        ):
            from sentry.preprod.snapshots.tasks import compare_snapshots

            compare_snapshots(
                project_id=self.project.id,
                org_id=self.organization.id,
                head_artifact_id=head_artifact.id,
                base_artifact_id=base_artifact.id,
            )

        comparison = PreprodSnapshotComparison.objects.get(
            head_snapshot_metrics__preprod_artifact=head_artifact
        )
        assert comparison.chunks_total == 1
        assert PreprodSnapshotComparisonChunk.objects.filter(comparison=comparison).count() == 1
        assert dispatch.call_count == 1
        assert poll.called  # scheduled early
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::CompareSnapshotsOrchestratorTest -p no:randomly`
Expected: FAIL (e.g. `AttributeError`/`ImportError` on `process_snapshot_comparison_chunk` / `poll_snapshot_comparison`, or `chunks_total is None`).

- [ ] **Step 3: Rewrite the orchestrator body**

Replace the odiff loop + finalization (`tasks.py:580-874`) with plan persistence + dispatch. Keep setup/guard/manifest-load. The new tail of `compare_snapshots`:

```python
    # ... after manifests are loaded (head_manifest, base_manifest) ...

    poll_snapshot_comparison.apply_async(
        kwargs={
            "comparison_id": comparison.id,
            "org_id": org_id,
            "project_id": project_id,
            "head_artifact_id": head_artifact_id,
            "base_artifact_id": base_artifact_id,
        },
        countdown=POLL_INTERVAL,
    )

    plan = _build_comparison_plan(head_manifest, base_manifest, head_artifact_id, base_artifact_id)

    plan_key = f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}/plan.json"
    _retry_objectstore(
        lambda: session.put(orjson.dumps(plan.dict()), key=plan_key, content_type="application/json")
    )

    for assignment in plan.chunks:
        PreprodSnapshotComparisonChunk.objects.update_or_create(
            comparison=comparison,
            chunk_index=assignment.chunk_index,
            defaults={
                "state": PreprodSnapshotComparisonChunk.State.PENDING,
                "image_count": len(assignment.candidates),
            },
        )

    for assignment in plan.chunks:
        process_snapshot_comparison_chunk.apply_async(
            kwargs={
                "comparison_id": comparison.id,
                "chunk_index": assignment.chunk_index,
                "org_id": org_id,
                "project_id": project_id,
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
            }
        )

    comparison.chunks_total = len(plan.chunks)
    comparison.save(update_fields=["chunks_total", "date_updated"])
```

Edge case: if `plan.chunks` is empty (no images need diffing — all unchanged/added/removed), still set `chunks_total = 0`; the poll will immediately finalize from `non_diff_images` only. Keep the early VCS start signal as-is.

Keep the `except BaseException` cleanup (`tasks.py:876-900`) — it still marks the comparison `FAILED` if orchestration itself raises (e.g. bad manifest), preserving current behavior.

> Removed in this task: the `with OdiffServer() as server:` loop and the in-task finalization (manifest build + `comparison.json` put + `images_*` save). They move to Tasks 7 and 8. Leave `_fetch_batch_images`, `compare_images_batch`, `_image_name_to_path_stem`, `_create_pixel_batches`, `categorize_image_diff` in place — Tasks 7/8 reuse them.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::CompareSnapshotsOrchestratorTest -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "ref(preprod): Turn compare_snapshots into a fan-out orchestrator"
```

---

## Task 7: Implement the chunk task

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py`

The chunk task reads `plan.json`, finds its `ChunkAssignment`, processes the slice with one `OdiffServer` (reusing the existing per-pair fetch/diff/upload logic at `tasks.py:589-722`), writes `chunks/{idx}.json`, and marks its row `DONE`. Idempotent: re-running overwrites masks + result blob and re-sets `DONE`.

- [ ] **Step 1: Write the failing test**

Append a test that patches `compare_images_batch` and `_fetch_batch_images` so no real odiff/objectstore image fetch runs:

```python
@cell_silo_test
class ProcessChunkTest(TestCase):
    def test_chunk_processes_slice_and_marks_done(self):
        from sentry.preprod.snapshots.manifest import (
            ChunkAssignment,
            ChunkCandidate,
            ComparisonPlan,
        )
        from sentry.preprod.snapshots.image_diff.types import DiffResult
        from sentry.preprod.snapshots.tasks import process_snapshot_comparison_chunk

        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head,
            base_snapshot_metrics=base,
            state=PreprodSnapshotComparison.State.PROCESSING,
        )
        chunk = PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison, chunk_index=0, image_count=1
        )

        plan = ComparisonPlan(
            head_artifact_id=head_artifact.id,
            base_artifact_id=base_artifact.id,
            chunks=[
                ChunkAssignment(
                    chunk_index=0,
                    candidates=[
                        ChunkCandidate(name="a.png", head_hash="h", base_hash="b", pixel_count=10)
                    ],
                )
            ],
            non_diff_images={},
        )
        plan_key = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}/plan.json"
        stored: dict[str, bytes] = {plan_key: orjson.dumps(plan.dict())}
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(key, contents)

        diff = DiffResult(
            diff_mask_png=b"png", changed_pixels=5, total_pixels=100,
            aligned_height=10, before_width=10, before_height=10, after_width=10, after_height=10,
        )

        with (
            patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session),
            patch(
                "sentry.preprod.snapshots.tasks._fetch_batch_images",
                return_value=({"h": b"img", "b": b"img"}, set()),
            ),
            patch("sentry.preprod.snapshots.tasks.compare_images_batch", return_value=[diff]),
        ):
            process_snapshot_comparison_chunk(
                comparison_id=comparison.id, chunk_index=0,
                org_id=self.organization.id, project_id=self.project.id,
                head_artifact_id=head_artifact.id, base_artifact_id=base_artifact.id,
            )

        chunk.refresh_from_db()
        assert chunk.state == PreprodSnapshotComparisonChunk.State.DONE
        result_key = f"{self.organization.id}/{self.project.id}/{head_artifact.id}/{base_artifact.id}/chunks/0.json"
        assert result_key in stored
```

Confirm the `DiffResult` field names against `src/sentry/preprod/snapshots/image_diff/types.py:6-16`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::ProcessChunkTest -p no:randomly`
Expected: FAIL with `ImportError: cannot import name 'process_snapshot_comparison_chunk'`.

- [ ] **Step 3: Implement the chunk task + `_process_chunk`**

Add to `tasks.py`:

```python
@instrumented_task(
    name="sentry.preprod.tasks.process_snapshot_comparison_chunk",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=CHUNK_PROCESSING_DEADLINE,
)
def process_snapshot_comparison_chunk(
    comparison_id: int,
    chunk_index: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    chunk = PreprodSnapshotComparisonChunk.objects.filter(
        comparison_id=comparison_id, chunk_index=chunk_index
    ).first()
    if chunk is None or chunk.state == PreprodSnapshotComparisonChunk.State.DONE:
        return

    PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
        state=PreprodSnapshotComparisonChunk.State.PROCESSING, date_updated=timezone.now()
    )

    session = get_preprod_session(org_id, project_id)
    plan_key = f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}/plan.json"
    plan = ComparisonPlan(**orjson.loads(_retry_objectstore(lambda: session.get(plan_key).payload.read())))
    assignment = next(c for c in plan.chunks if c.chunk_index == chunk_index)

    images = _process_chunk(
        session, assignment, org_id, project_id, head_artifact_id, base_artifact_id,
        head_manifest_images={},  # see note: pass per-image diff_threshold source
    )

    result_key = f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}/chunks/{chunk_index}.json"
    result = ChunkResult(chunk_index=chunk_index, images=images)
    _retry_objectstore(
        lambda: session.put(orjson.dumps(result.dict()), key=result_key, content_type="application/json")
    )

    PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
        state=PreprodSnapshotComparisonChunk.State.DONE, date_updated=timezone.now()
    )
```

`_process_chunk` is the existing per-batch body relocated from `tasks.py:589-722`: collect unique hashes → `_fetch_batch_images` → build `(base_data, head_data)` pairs → `compare_images_batch(pairs, server=server)` under one `with OdiffServer() as server:` → per result, upload mask via `_retry_objectstore`, classify `changed`/`unchanged`/`errored`, build `ComparisonImageResult`. It returns `dict[str, ComparisonImageResult]`. Move the diff-threshold resolution (`tasks.py` `effective_threshold` logic) with it.

> Note on `diff_threshold`: the per-image threshold currently comes from the head manifest's `ImageMetadata.diff_threshold` (then manifest-level, then 0.0). Carry the resolved threshold into each `ChunkCandidate` in Task 5 (add a `diff_threshold: float` field) so the chunk task does not need the manifest. Update the `ChunkCandidate` schema and `_build_comparison_plan` accordingly. (Adjust Task 3/5 if implementing this note — preferred over re-loading the manifest in the chunk.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::ProcessChunkTest -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "feat(preprod): Add snapshot comparison chunk task"
```

---

## Task 8: Implement the polling finalizer / watchdog

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py`

The poll is the universal watchdog. It implements the branch logic from the spec's "Polling finalizer" section.

- [ ] **Step 1: Write the failing tests**

Append tests covering the key branches (terminal exit, all-done finalize, stale-chunk re-dispatch, dead-orchestrator re-dispatch, partial success):

```python
@cell_silo_test
class PollSnapshotComparisonTest(TestCase):
    def _comparison(self, chunks_total, state=PreprodSnapshotComparison.State.PROCESSING):
        head_artifact = self.create_preprod_artifact(project=self.project)
        base_artifact = self.create_preprod_artifact(project=self.project)
        head = self.create_preprod_snapshot_metrics(head_artifact)
        base = self.create_preprod_snapshot_metrics(base_artifact)
        comparison = self.create_preprod_snapshot_comparison(
            head_snapshot_metrics=head, base_snapshot_metrics=base, state=state
        )
        comparison.chunks_total = chunks_total
        comparison.save()
        return comparison, head_artifact, base_artifact

    def _kwargs(self, comparison, head_artifact, base_artifact):
        return dict(
            comparison_id=comparison.id, org_id=self.organization.id, project_id=self.project.id,
            head_artifact_id=head_artifact.id, base_artifact_id=base_artifact.id,
        )

    def test_terminal_state_stops(self):
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1, state=PreprodSnapshotComparison.State.SUCCESS)
        with patch("sentry.preprod.snapshots.tasks.poll_snapshot_comparison.apply_async") as reschedule:
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert not reschedule.called

    def test_all_done_finalizes(self):
        from sentry.preprod.snapshots.manifest import ComparisonImageResult, ChunkResult, ComparisonPlan
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison, chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.DONE, image_count=1,
        )
        prefix = f"{self.organization.id}/{self.project.id}/{h.id}/{b.id}"
        plan = ComparisonPlan(head_artifact_id=h.id, base_artifact_id=b.id, chunks=[], non_diff_images={})
        chunk_result = ChunkResult(chunk_index=0, images={"a.png": ComparisonImageResult(status="changed")})
        stored = {
            f"{prefix}/plan.json": orjson.dumps(plan.dict()),
            f"{prefix}/chunks/0.json": orjson.dumps(chunk_result.dict()),
        }
        session = _mock_session_with_manifests(stored)
        session.put.side_effect = lambda contents, key, content_type: stored.__setitem__(key, contents)
        with patch("sentry.preprod.snapshots.tasks.get_preprod_session", return_value=session):
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        comparison.refresh_from_db()
        assert comparison.state == PreprodSnapshotComparison.State.SUCCESS
        assert comparison.images_changed == 1
        assert f"{prefix}/comparison.json" in stored

    def test_dead_orchestrator_redispatched(self):
        from django.utils import timezone
        from datetime import timedelta
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(None)  # chunks_total NULL = orchestration unfinished
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(
            date_updated=timezone.now() - timedelta(seconds=10_000)
        )
        with patch("sentry.preprod.snapshots.tasks.compare_snapshots.apply_async") as orch:
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert orch.called

    def test_stale_chunk_redispatched(self):
        from django.utils import timezone
        from datetime import timedelta
        from sentry.preprod.snapshots.tasks import poll_snapshot_comparison

        comparison, h, b = self._comparison(1)
        chunk = PreprodSnapshotComparisonChunk.objects.create(
            comparison=comparison, chunk_index=0,
            state=PreprodSnapshotComparisonChunk.State.PROCESSING, attempts=0,
        )
        PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
            date_updated=timezone.now() - timedelta(seconds=10_000)
        )
        with patch("sentry.preprod.snapshots.tasks.process_snapshot_comparison_chunk.apply_async") as redispatch:
            poll_snapshot_comparison(**self._kwargs(comparison, h, b))
        assert redispatch.called
        chunk.refresh_from_db()
        assert chunk.attempts == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::PollSnapshotComparisonTest -p no:randomly`
Expected: FAIL with `ImportError: cannot import name 'poll_snapshot_comparison'`.

- [ ] **Step 3: Implement the poll + `_finalize_comparison`**

Add to `tasks.py`:

```python
@instrumented_task(
    name="sentry.preprod.tasks.poll_snapshot_comparison",
    namespace=preprod_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=60,
)
def poll_snapshot_comparison(
    comparison_id: int,
    org_id: int,
    project_id: int,
    head_artifact_id: int,
    base_artifact_id: int,
) -> None:
    comparison = PreprodSnapshotComparison.objects.filter(id=comparison_id).first()
    if comparison is None:
        return
    if comparison.state in (
        PreprodSnapshotComparison.State.SUCCESS,
        PreprodSnapshotComparison.State.FAILED,
    ):
        return  # terminal; idempotent exit, no reschedule

    now = timezone.now()
    stale_cutoff = now - timedelta(seconds=CHUNK_STALE_THRESHOLD)
    over_budget = (now - comparison.date_added).total_seconds() > COMPARISON_BUDGET

    def _reschedule() -> None:
        # Bump date_updated so the hourly reaper does not reap an actively-polled comparison.
        PreprodSnapshotComparison.objects.filter(id=comparison.id).update(date_updated=now)
        poll_snapshot_comparison.apply_async(
            kwargs={
                "comparison_id": comparison_id, "org_id": org_id, "project_id": project_id,
                "head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id,
            },
            countdown=POLL_INTERVAL,
        )

    # Orchestration phase: orchestrator has not finished building the plan.
    if comparison.chunks_total is None:
        if comparison.date_updated <= stale_cutoff:
            compare_snapshots.apply_async(
                kwargs={
                    "project_id": project_id, "org_id": org_id,
                    "head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id,
                }
            )
        _reschedule()
        return

    # Chunk phase.
    chunks = list(PreprodSnapshotComparisonChunk.objects.filter(comparison_id=comparison_id))
    done = sum(1 for c in chunks if c.state == PreprodSnapshotComparisonChunk.State.DONE)

    if done == comparison.chunks_total:
        _finalize_comparison(comparison, org_id, project_id, head_artifact_id, base_artifact_id, chunks)
        return

    if over_budget:
        # Mark not-done chunks FAILED, then partial-finalize.
        PreprodSnapshotComparisonChunk.objects.filter(comparison_id=comparison_id).exclude(
            state=PreprodSnapshotComparisonChunk.State.DONE
        ).update(state=PreprodSnapshotComparisonChunk.State.FAILED)
        chunks = list(PreprodSnapshotComparisonChunk.objects.filter(comparison_id=comparison_id))
        _finalize_comparison(comparison, org_id, project_id, head_artifact_id, base_artifact_id, chunks)
        return

    # Re-dispatch dead chunks.
    for chunk in chunks:
        if chunk.state in (
            PreprodSnapshotComparisonChunk.State.PENDING,
            PreprodSnapshotComparisonChunk.State.PROCESSING,
        ) and chunk.date_updated <= stale_cutoff:
            if chunk.attempts >= MAX_CHUNK_ATTEMPTS:
                PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
                    state=PreprodSnapshotComparisonChunk.State.FAILED
                )
            else:
                PreprodSnapshotComparisonChunk.objects.filter(id=chunk.id).update(
                    attempts=chunk.attempts + 1, date_updated=now
                )
                process_snapshot_comparison_chunk.apply_async(
                    kwargs={
                        "comparison_id": comparison_id, "chunk_index": chunk.chunk_index,
                        "org_id": org_id, "project_id": project_id,
                        "head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id,
                    }
                )

    _reschedule()
```

`_finalize_comparison` merges all results and flips `SUCCESS` exactly once:

```python
def _finalize_comparison(comparison, org_id, project_id, head_artifact_id, base_artifact_id, chunks) -> None:
    session = get_preprod_session(org_id, project_id)
    prefix = f"{org_id}/{project_id}/{head_artifact_id}/{base_artifact_id}"
    plan = ComparisonPlan(**orjson.loads(_retry_objectstore(lambda: session.get(f"{prefix}/plan.json").payload.read())))

    images: dict[str, ComparisonImageResult] = dict(plan.non_diff_images)

    assignment_by_index = {c.chunk_index: c for c in plan.chunks}
    for chunk in chunks:
        if chunk.state == PreprodSnapshotComparisonChunk.State.DONE:
            result = ChunkResult(
                **orjson.loads(
                    _retry_objectstore(lambda: session.get(f"{prefix}/chunks/{chunk.chunk_index}.json").payload.read())
                )
            )
            images.update(result.images)
        elif chunk.state == PreprodSnapshotComparisonChunk.State.FAILED:
            for candidate in assignment_by_index[chunk.chunk_index].candidates:
                images[candidate.name] = ComparisonImageResult(
                    status="errored", head_hash=candidate.head_hash,
                    base_hash=candidate.base_hash, reason="chunk_failed",
                )

    counts = {s: 0 for s in ("changed", "unchanged", "added", "removed", "errored", "renamed", "skipped")}
    for result in images.values():
        if result.status in counts:
            counts[result.status] += 1

    comparison_manifest = ComparisonManifest(
        head_artifact_id=head_artifact_id, base_artifact_id=base_artifact_id,
        summary=ComparisonSummary(total=len(images), **counts), images=images,
    )
    comparison_key = f"{prefix}/comparison.json"
    _retry_objectstore(
        lambda: session.put(orjson.dumps(comparison_manifest.dict()), key=comparison_key, content_type="application/json")
    )

    extras = comparison.extras or {}
    extras["comparison_key"] = comparison_key
    extras["diff_algorithm_version"] = DIFF_ALGORITHM_VERSION
    updated = PreprodSnapshotComparison.objects.filter(
        id=comparison.id, state=PreprodSnapshotComparison.State.PROCESSING
    ).update(
        state=PreprodSnapshotComparison.State.SUCCESS, error_code=None,
        images_changed=counts["changed"], images_unchanged=counts["unchanged"],
        images_added=counts["added"], images_removed=counts["removed"],
        images_renamed=counts["renamed"], images_skipped=counts["skipped"],
        extras=extras, date_updated=timezone.now(),
    )
    if updated:
        update_preprod_snapshot_vcs(preprod_artifact_id=head_artifact_id, caller="compare_completion")
```

Add imports: `from datetime import timedelta`; `ChunkResult`, `ComparisonImageResult` to the manifest import block. The guarded `.update(... state=PROCESSING)` is the exactly-once `SUCCESS` flip.

> Note: `_finalize_comparison` uses `chunk.chunk_index` inside a `lambda` in a loop — bind it explicitly (e.g. `idx = chunk.chunk_index`) to avoid the late-binding closure bug.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py::PollSnapshotComparisonTest -p no:randomly`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "feat(preprod): Add polling finalizer/watchdog for snapshot comparison"
```

---

## Task 9: Cleanup, end-to-end test, and lint

**Files:**

- Modify: `src/sentry/preprod/snapshots/tasks.py`
- Test: `tests/sentry/preprod/snapshots/test_compare_snapshots.py`

- [ ] **Step 1: Remove dead code**

Delete any now-unused imports/helpers left after the split (e.g. confirm `ComparisonSummary`/`ComparisonManifest` are still imported for `_finalize_comparison`; remove the old odiff TODO comment at `tasks.py:587-588`). Confirm `threading` + `ContextPropagatingThreadPoolExecutor` are still used by `_fetch_batch_images` (they are — keep them).

- [ ] **Step 2: Write an end-to-end test**

Append a test that runs orchestrator → (manually invoke each dispatched chunk) → poll, asserting a multi-chunk build reaches `SUCCESS` with correct counts, and a separate test where one chunk is left non-DONE past budget reaches `SUCCESS` with `images_errored > 0` (partial success). Use the same mocking approach as Tasks 6–8 (patch `get_preprod_session`, `_fetch_batch_images`, `compare_images_batch`; capture `apply_async` calls and invoke the task functions directly with the captured kwargs).

- [ ] **Step 3: Run the full file**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -n3 -svv --reuse-db tests/sentry/preprod/snapshots/test_compare_snapshots.py -p no:randomly`
Expected: PASS (all classes).

- [ ] **Step 4: Run lint + typecheck**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/prek run -q --files src/sentry/preprod/snapshots/tasks.py src/sentry/preprod/snapshots/models.py src/sentry/preprod/snapshots/manifest.py`
Expected: all hooks pass (fix mypy/ruff issues, re-stage, re-run until clean).

- [ ] **Step 5: Run the related existing tests**

Run: `cd /Users/nicolashinderling/dev/sentry && .venv/bin/pytest -n3 -svv --reuse-db tests/sentry/preprod/snapshots/ -p no:randomly`
Expected: PASS (categorizer, manifest, auto-approve, tasks still green).

- [ ] **Step 6: Commit**

```bash
cd /Users/nicolashinderling/dev/sentry
git add src/sentry/preprod/snapshots/tasks.py tests/sentry/preprod/snapshots/test_compare_snapshots.py
git commit -m "test(preprod): End-to-end fan-out tests + cleanup"
```

---

## Self-review notes (addressed)

- **Spec coverage:** orchestrator (Task 6), chunk task (Task 7), poll/finalizer + recovery + partial-success + budget (Task 8), `chunks_total` column + chunk model (Tasks 1–2), plan/result schemas (Task 3), `_retry_objectstore` carry-forward (Task 4), determinism via status-count merge (Task 8 `_finalize_comparison`), in-chunk fetch pool retained (Task 7 note).
- **`diff_threshold` carry:** Task 7's note adds `diff_threshold` to `ChunkCandidate` so chunks don't reload the manifest — apply that field in Tasks 3 and 5 when implementing.
- **Closure late-binding:** flagged in Task 8 (`idx = chunk.chunk_index` before the `lambda`).
- **Reaper interaction:** the poll bumps `comparison.date_updated` each wake so the 30-min hourly reaper won't reap an actively-polled comparison; `COMPARISON_BUDGET=1500s` resolves before the reaper would anyway.
