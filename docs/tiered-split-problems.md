# Tiered Split: Known Flake Patterns

Patterns observed in tier 2 (`backend test (N)`) shards on `mchen/ci-tiered-split`.
These are **pre-existing flakes that exist on master too**, but are amplified in tier 2
because Snuba-using tests now cluster together, concentrating their flakiness into fewer
shards. Documenting here for visibility and to guide future fixes.

## 1. Snuba `RateLimitExceeded` (CrossOrgQueryAllocationPolicy)

**Symptom**

```
sentry.utils.snuba.RateLimitExceeded: Query on could not be run due to allocation policies, info:
  {'CrossOrgQueryAllocationPolicy': {
    'rejection_threshold': 4,
    'quota_used': 5,
    'reason': 'concurrent policy 5 exceeds limit of 4',
    'storage_key': 'errors',
  }}
```

**What it means**

Snuba enforces a per-storage concurrent-query allocation policy. The `errors` storage
allows at most 4 concurrent queries before rejecting the 5th. The test
`backfill_supergroups_lightweight` issues parallel queries via `bulk_snuba_queries`
(thread pool), which fans out to >4 concurrent queries, tripping the policy.

**Where it shows up**

- `tests/sentry/tasks/seer/test_backfill_supergroups_lightweight.py`
- Anywhere `bulk_snuba_queries` is called with a wide query list

**Workaround applied (this branch)**

Cap `bulk_snuba_queries`'s `ContextPropagatingThreadPoolExecutor` to 4 workers
when `XDIST_PER_WORKER_SNUBA=1` is set (i.e. in CI tier 2 jobs). This matches
the per-storage `rejection_threshold` so we never fan out wider than the policy
allows. Production keeps the wider pool of 10 since prod has higher thresholds.

**Future, productionized fix**

Bump `rejection_threshold` for the `errors` storage in the snuba repo's storage
YAML (`snuba/datasets/configuration/errors/storages/errors.yaml`) for CI mode.
This is a snuba-side change and would let us revert the sentry-side cap.

## 2. Snuba data ordering / count races

**Symptom**

```
tests/snuba/tasks/test_unmerge.py:309: in test_unmerge
    assert ... == [(11, time_from_now(0), time_from_now(16))]
E   assert [(19, ...)] == [(11, ...)]
```

The test created 11 events, the assertion got back 19. **8 extra events leaked in from
a previous test.**

**What it means**

Even with per-worker Snuba isolation (`XDIST_PER_WORKER_SNUBA=1`), the per-worker
reset between tests is not perfectly synchronous. ClickHouse writes are async; if a
prior test's events haven't been fully flushed/dropped before the next test's
`reset_snuba` call, they show up in the new test's queries.

**Other instances of the same pattern in this run**

- `DeleteWorkflowEngineModelsTest.test_delete_error_events` — `assert 1 == 0`, where
  the 1 is a leftover Event from a prior test
- `TestGetActiveOrgsMeasureFiltering.test_segments_measure_multiple_orgs` — expected
  org_id missing from query result; the result contained only orgs from prior tests

**Why tier 2 amplifies it**

On master, these tests are spread across 22 shards alongside many non-Snuba tests, so
each Snuba-heavy test gets relatively quiet bursts. In tier 2, they run back-to-back,
so the reset-flush race window is exercised much more often.

**Proposed fixes**

1. Make `reset_snuba` block on a ClickHouse `OPTIMIZE TABLE ... FINAL` or equivalent
   to force a flush of pending writes before returning.
2. Add a deterministic `event_id` filter to the assertion so the test only sees its
   own events. Higher-effort but eliminates the flake category entirely.

## 3. `unclosed_files` fixture false positives (cacert.pem)

**Symptom**

```
tests/conftest.py:67: in unclosed_files
    assert _open_files() == fds
E   AssertionError: assert frozenset({'/dev/null'}) == frozenset({'.../cacert.pem'})
E   Extra items in the right set:
E     '/.../site-packages/certifi/cacert.pem'
```

**What it means**

The fixture snapshots open files **before** a test (`fds`) and asserts the snapshot is
identical **after** the test. The right-hand side (`fds`) had `cacert.pem` open, the
left-hand side (post-test) does not — i.e. the file was **closed** during the test.

This isn't a leak by the failing test. A **prior** test made an HTTPS request and
held an SSL context that kept `cacert.pem` open. Garbage collection during the
current test reclaimed that context, closing the file. The fixture's strict equality
flags it as a leak even though it's the opposite — the prior test was the leaky one.

**Proposed fix** (already applied in this branch)

Change the assertion direction: only fail when **new** files are leaked into the
post-test snapshot, not when previously-open files get closed:

```python
yield
new = _open_files() - fds
assert not new, f"Test leaked file descriptors: {new}"
```

This keeps the leak-detection signal but stops false-positives from late GC.

## 4. Cross-test database / state isolation flakes

**Symptom (workflow-engine deletion test)**

```
tests/sentry/deletions/test_project.py:233: in test_delete_error_events
    assert len(events) == 0
E   assert 1 == 0
```

**Symptom (segments measure filtering)**

```
tests/sentry/dynamic_sampling/tasks/test_common.py:256
E   assert 4558031417245744 in [4558031417245712, 4558031417245714, 4558031417245715]
```

**What it means**

Same root cause as #2: state from a prior test leaked into the current test's query
results. In the workflow-engine case, an Event from a prior test wasn't deleted
before this test's deletion check ran. In the dynamic sampling case, an "active orgs"
query returned the prior tests' orgs because the new org wasn't yet visible.

**Proposed fixes**

Same as #2 — force flush in `reset_snuba`, or scope assertions to test-specific IDs.

## Summary

| # | Pattern | Status on this branch | PR breakdown |
|---|---|---|---|
| 1 | Snuba `RateLimitExceeded` | Workaround applied (sentry-side pool cap) | Bundle with the tiered-split PR; ship snuba-side `rejection_threshold` bump as a follow-up that lets us revert the cap. |
| 2 | Snuba data ordering races | Documented only — needs `reset_snuba` flush behavior change | **Separate PR.** Same root cause as #4; one targeted fix to `reset_snuba` (e.g. force-flush async insert queue, or barrier-and-retry) covers both. Pre-existing on master, just amplified by tier 2. |
| 3 | `unclosed_files` false positive | Fixed in this branch | Bundle with the tiered-split PR. The fix is general — fixture was wrong for everyone. |
| 4 | Cross-test state isolation | Documented only — same as #2 | **Same separate PR as #2.** Both are the same `reset_snuba` flush bug surfacing in postgres-via-snuba-derived data and in event-store data. |

**Productionization plan**

- **Tiered-split PR** (this branch): includes #1 workaround (pool cap) and #3 fix
  (fixture). These are both mechanical and don't change test behavior in master.
- **Snuba-side PR** (follow-up): bumps `rejection_threshold` so we can revert #1.
  Optional / nice-to-have; the cap works fine standing alone.
- **`reset_snuba` flush PR** (separate): addresses #2 and #4 together. Should
  ship before or alongside tiered-split if the flake rate is unacceptable, but
  the bug exists on master too.
