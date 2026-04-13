---
name: fix-flaky-tests
description: Fix flaky tests identified by the shuffle-tests-across-shards workflow. Takes a GitHub Actions run URL, downloads per-shard failure artifacts, and fixes each flaky test with an individual commit. Use when given a shuffle-tests run URL, asked to "fix flaky tests", or working from a list of test node IDs with tracebacks.
---

# Fix Flaky Tests

## 1. Extract failures

```bash
RUN_ID=<id from URL>
mkdir -p /tmp/shuffle-failures
gh run download "$RUN_ID" --repo getsentry/sentry --pattern "failure-*" --dir /tmp/shuffle-failures/
python3 -c "
import json, pathlib
for p in sorted(pathlib.Path('/tmp/shuffle-failures').rglob('failure.json')):
    d = json.loads(p.read_text())
    print(f'[{d[\"type\"]}] {d[\"testid\"]}')
    print('  ' + d.get('longrepr','')[-300:])
"
```

If no URL: `gh run list --repo getsentry/sentry --workflow shuffle-tests-across-shards.yml --limit 5`

If artifacts expired: `gh run view "$RUN_ID" --repo getsentry/sentry --log | grep -A2 "Created issue\|Commented on"`

**Only fix `type: "flaky"`.** Route `type: "pollution"` to the `fix-test-pollution` skill.

## 2. Triage each failure

Read the test file and the full `longrepr` traceback. Use `references/common-patterns.md` to classify. You must be able to state: _"This fails because X."_

**Skip and note** if: fix requires production code changes, root cause is unclear, test needs real network/external services.

## 3. Fix, verify, commit — one test at a time

**Verification is mandatory before every commit. Do not skip it.**

```bash
.venv/bin/pytest -xvs "<testid>" --reuse-db          # MUST pass — stop if it doesn't
.venv/bin/pytest -xvs "<test_file>" --reuse-db        # MUST pass — no regressions
.venv/bin/pre-commit run --files <changed_files>      # fix lint before committing
```

If the isolated test passes but the module run fails, your fix introduced a regression — revert and rethink before committing.

Commit with the `commit` skill, type `test`:

```
test(<module>): Fix flaky <TestClass>::<test_method>

<why it was flaky> / <what the fix does>
```

## 4. Report

- **Fixed**: node ID + root cause + commit SHA
- **Skipped**: node ID + reason
- **Pollution**: list for `fix-test-pollution`

## TODO — Known Unfixed Flakes

Keep this list updated. Add entries when a test is skipped with no fix; remove when fixed.

| Test                                                                                                                                                               | Symptom                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/snuba/api/endpoints/test_organization_events_stats.py::OrganizationEventsStatsEndpointTest::test_simple`                                                    | `CrossTransactionAssertionError: Transaction opened for db {'default'}, but command running against db control` | Order-dependent; `simulated_transaction_watermarks` state leaks from a prior test. The fixture resets it correctly on paper — root cause unclear without reproduction. Debug instrumentation added to the test to capture watermark state on failure.                                                                                               |
| `tests/sentry/core/endpoints/test_organization_index.py::OrganizationsCreateTest::test_data_consent`                                                               | HTTP 500 response instead of 2xx                                                                                | Single occurrence. Likely a DB constraint or unhandled exception triggered by order-dependent state from a prior test. Check for missing teardown of org/user fixtures.                                                                                                                                                                             |
| `tests/sentry/sentry_metrics/test_all_indexers.py::test_rate_limited[UseCaseID.SESSIONS-PGStringIndexerV2]`                                                        | `{'z': 4} != {'z': None}` — string `z` indexed when it should be rate-limited                                   | Redis `flushdb()` clears the rate limiter counter between the first and second `bulk_record` call, allowing `z` to be indexed (rate limit resets). Fix: use a unique Redis key prefix per test run, or increase the rate limit window so one flushdb cannot reset it within the test.                                                               |
| `tests/sentry/preprod/api/endpoints/test_builds.py::BuildsEndpointTest::test_free_text_search_by_build_id`                                                         | `assert 2 == 1` — returns 2 builds matching search when only 1 expected                                         | Test pollution: another test's build record visible in the same DB transaction scope. Look for test class using `TransactionTestCase` (no rollback) or a missing `flush=False` on outbox.                                                                                                                                                           |
| `tests/sentry/integrations/oauth2/test_flow.py::OAuth2FlowTest::test_oauth2_flow_customer_domain`                                                                  | Integration pipeline state missing mid-flow                                                                     | Appears occasionally despite `_callTestMethod` guard. The customer-domain flow sets `state.data` fields that must survive into the callback step; investigate whether a second `initialize()` is needed just before the callback POST.                                                                                                              |
| `tests/sentry/uptime/endpoints/test_organization_uptime_alert_index.py::OrganizationUptimeAlertIndexEndpointTest::test_owner_filter`                               | Extra uptime alerts returned — first item at index 0 doesn't match expected                                     | `check_valid_response` does an ordered equality check. Stale uptime detectors from a prior test bleed in. The test uses `get_success_response` which queries the org-level index; another test in the same DB transaction scope left a visible uptime detector. Investigate `TransactionTestCase` usage or missing `flush=False` in the base class. |
| `tests/sentry/api/endpoints/test_organization_sampling_project_span_counts.py::OrganizationSamplingProjectSpanCountsTest::test_get_span_counts_with_many_projects` | `MaxSnowflakeRetryError` creating project ~150 of 200                                                           | Already uses `time_machine.travel(tick=True)` guard. Fails with 5 consecutive `IntegrityError` on Project slug or ID uniqueness. Possibly related to `@cell_silo_test` generating a secondary test class that leaves stale DB state. Investigate whether the generated silo-mode class uses `TransactionTestCase`.                                  |
| `tests/sentry/integrations/slack/notifications/test_deploy.py::SlackDeployNotificationTest::test_deploy_block`                                                     | `'battlesnake \| ...' != 'bar \| ...'` in footer                                                                | Slack notification footer project (`blocks[1]`) and project list (`blocks[2]`) may have different orderings. Test computes `first_project` from `blocks[2]` ordering but `blocks[1]` uses its own ordering; when extra stale projects exist in the DB, these diverge.                                                                               |
| `tests/sentry/spans/test_buffer.py::test_deep[cluster-nochunk-spans113]`                                                                                           | `assert not [b'test_key']` in assert_clean                                                                      | Spans buffer uses a Redis Cluster at ports 7000-7005 shared across xdist workers. A concurrent worker writes `b'test_key'` and doesn't clean up before `assert_clean`. Identify which test creates it and add a teardown flush or use a unique key prefix.                                                                                          |
| `tests/sentry/middleware/test_ratelimit_middleware.py::TestConcurrentRateLimiter::test_concurrent_request_rate_limiting`                                           | `[0, 1, 2, 2] != [0, 0, 1, 2]` concurrent slots                                                                 | Timing-sensitive: `test_request_finishes` runs immediately before and may leave a stale counter. The `sleep(0.01)` jitter is inherently racy. Add explicit counter reset in setUp, or use a unique rate limit key per test class run.                                                                                                               |

---

## Progress & Inventory

This section documents all work done on the `shuffle-tests-v2` branch to stabilize the shuffle workflow. Use it to understand the current state before starting a new round of fixes.

### Workflow changes (`shuffle-tests-across-shards.yml`)

| Change                                        | Description                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 11 → 16 shards                                | Expanded matrix from 11 to 16 `MATRIX_INSTANCE_TOTAL` instances for broader coverage                                                      |
| Devservices parallelization                   | Spawned `bootstrap-snuba.py` in background during devservices wait, overlapping ClickHouse init with venv setup                           |
| Per-worker Snuba (`XDIST_PER_WORKER_SNUBA=1`) | Each xdist worker gets its own Snuba gateway container (`snuba-gwN`), avoiding cross-worker query interference                            |
| Removed GitHub issue creation                 | Replaced per-failure issue creation with consolidated `report` job writing to `GITHUB_STEP_SUMMARY`                                       |
| Re-enabled pollution detection                | Restored `detect_test_pollution.py` bisection step after each shard failure; writes `POLLUTING_TESTID` into `failure.json`                |
| Failure artifact schema                       | Each shard uploads `failure.json` with `type: "flaky"` or `type: "pollution"`, plus traceback or polluter ID                              |
| `report` job                                  | Aggregates all `failure-*` artifacts, deduplicates by testid, emits consolidated markdown to step summary                                 |
| `testids` truncation                          | After failure, truncates `testids-full` to stop at the failing test — prevents irrelevant tests from appearing as candidates in bisection |

### Systemic infrastructure changes (production + testutils)

These changes fix entire categories of flakes rather than individual tests.

#### 1. `IntegrationTestCase._callTestMethod()` guard — `src/sentry/testutils/cases.py`

**Problem**: `setUp()` stores pipeline state in Redis. A concurrent xdist worker's `flushdb()` can clear it in the window between `setUp` and the first HTTP request.

**Fix**: Override `_callTestMethod(*args, **kwargs)` to call `self.pipeline.initialize()` + `self.save_session()` immediately before the test body. Signature must accept `*args, **kwargs` for Django 5.2 compatibility.

```python
def _callTestMethod(self, *args: Any, **kwargs: Any) -> None:
    self.pipeline.initialize()
    self.save_session()
    super()._callTestMethod(*args, **kwargs)
```

#### 2. `RedisSessionStore` Django session fallback — `src/sentry/utils/session_store.py`

**Problem**: `PipelineSessionStore` state vanishes when Redis is flushed between pipeline steps.

**Fix**: On `regenerate()`, write state to both Redis and a Django DB session key. On Redis miss in `get_state()`, fall back to the DB copy and re-warm Redis. `clear()` removes both. Malformed Redis data (corrupt JSON) short-circuits to `None` without falling back, preserving `test_malformed_state` behavior.

#### 3. `optimize_snuba_table()` helper — `src/sentry/testutils/helpers/clickhouse.py`

**Problem**: ClickHouse `ReplacingMergeTree` keeps stale rows until background merge runs. Under 16-shard parallel load this can take 60+ seconds, causing deletion/merge count assertions to fail intermittently.

**Fix**: New helper that calls `POST /tests/{dataset}/optimize` on Snuba, which executes `OPTIMIZE TABLE {table} FINAL` — forcing immediate deduplication.

```python
from sentry.testutils.helpers.clickhouse import optimize_snuba_table
optimize_snuba_table("events")       # before querying Snuba after merge/delete ops
optimize_snuba_table("groupedmessage")
```

Applied in: `test_groups.py`, `test_nodestore.py`, `test_project.py`, `test_reprocessing2.py` (all variants), `test_merge.py`, `test_unmerge.py`, `test_data_export.py`.

#### 4. `reset_trace_context()` helper — `src/sentry/testutils/helpers/sdk.py`

**Problem**: `sentry_sdk.isolation_scope()` shallow-copies the parent scope, inheriting its `span`. `get_trace_id()` then returns a non-None trace_id even when no span is expected.

**Fix**: Context manager combining `isolation_scope()` with an explicit `scope.span = None`.

```python
from sentry.testutils.helpers.sdk import reset_trace_context
with reset_trace_context():
    handler.emit(record)
```

#### 5. xdist worker Redis DB isolation — `src/sentry/testutils/pytest/xdist.py` + `sentry.py`

**Problem**: Hard `_MAX_WORKERS = 7` limit raised `RuntimeError` when `XDIST_WORKERS=3` with many processes. Workers past index 7 shared Redis DBs.

**Fix**: Removed hard cap; uses `(9 + worker_num) % N_DATABASES` modulo wrapping so adjacent workers may share a DB but sequential tests within a worker are still isolated by `flushdb()`. After updating `redis.clusters` settings, the options store local cache and `redis_clusters` manager cache are explicitly flushed so the correct per-worker DB is used from the first cluster access.

#### 6. `PairwiseSync` barrier replacement — `tests/sentry/hybridcloud/models/test_outbox.py`

**Problem**: `threading.Barrier(n, timeout=1)` raises `BrokenBarrierError` under slow CI when one thread arrives 1s+ after the other.

**Fix**: `_PairwiseSync` — a semaphore-based rendezvous that blocks indefinitely instead of timing out. Both threads signal each other and wait; no timeout means no `BrokenBarrierError`.

### Snuba changes (`~/dev/snuba`)

| File                              | Change                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `snuba/web/views.py`              | Added `POST /tests/<dataset>/optimize` route: iterates all entity storages, calls `OPTIMIZE TABLE {db}.{table} FINAL` on each node                                                                     |
| `.github/workflows/image.yml`     | Added `concurrency` group to cancel in-progress builds on new push; set `publish_on_pr: true` so `assemble` can find the image SHA on PR branches; `assemble` now runs on all events (was master-only) |
| `devservices/config.yml` (Sentry) | Pinned all Snuba remote dependencies to `branch: test-optimize-endpoint` (Snuba PR #7869) which contains the optimize endpoint                                                                         |

### Individual test fixes (grouped by root cause)

#### ClickHouse merge lag / Snuba async propagation

- `tests/snuba/tasks/test_unmerge.py` — Drop events + groupedmessage in Snuba, re-store events with clean data, `optimize_snuba_table("events")` + `optimize_snuba_table("groupedmessage")` before assertions; `batch_size=20` to avoid inter-batch races
- `tests/sentry/event_manager/test_groups.py` — `optimize_snuba_table("events")` before count assertions
- `tests/sentry/nodestore/test_nodestore.py` — same
- `tests/sentry/event_manager/test_project.py` — same
- `tests/sentry/reprocessing2/test_reprocessing2.py` (multiple variants) — optimize before fetching events; moved optimize call to BEFORE `get_event_by_processing_counter` (was after, causing stale group_id)
- `tests/snuba/api/endpoints/test_merge.py` — optimize before assertions
- `tests/sentry/replays/test_data_export.py` — `call_snuba("/tests/replays/drop")` to clear stale replay data before test

#### Snowflake ID exhaustion under `freeze_time`

- `tests/sentry/dynamic_sampling/tasks/test_tasks.py` — Wrapped all `create_project` calls in `time_machine.travel(MOCK_DATETIME, tick=True)` so Snowflake IDs advance normally despite frozen time
- `tests/sentry/seer/explorer/test_explorer_client.py` — Same pattern; also fixed `StopIteration` by replacing `[0, 0, 200]` side_effect with `chain([0, 0], repeat(200))`

#### Redis `flushdb()` race

- `tests/sentry/web/frontend/test_auth_login.py::test_login_ratelimited_user` — Pre-fill rate limiter via `ratelimiter.backend.is_limited(key, limit=5, window=60)` instead of 5 HTTP round-trips (eliminates 5 extra requests where flushdb can strike)
- `tests/sentry/middleware/test_ratelimit_middleware.py::test_impersonation_enforces_rate_limits_when_disabled` — Same pattern with `request.rate_limit_key`; also fixed `ContextPropagatingThreadPoolExecutor` import

#### Isolation scope / trace context leak

- `tests/sentry/logging/test_handler.py::test_emit[record3-out3]` — Replaced `sentry_sdk.isolation_scope()` with `reset_trace_context()` to clear parent span
- `tests/sentry/logging/test_gke_emit.py` — Same fix

#### Global `time` module patching

- `tests/sentry/conduit/test_tasks.py::test_stream_demo_data_sends_all_phases` — Changed `@patch("sentry.conduit.tasks.time.sleep")` to `@patch("sentry.conduit.tasks.time")` to avoid counting `time.sleep` calls from unrelated modules (retry machinery). Assert `mock_time.sleep.call_count`.
- `tests/sentry/seer/explorer/test_explorer_client.py::test_push_changes_timeout` — Same root cause; replaced `[0, 0, 200]` side_effect list with `chain([0, 0], repeat(200))` to avoid `StopIteration` from extra `time.time()` calls

#### Outbox coalescing / barrier

- `tests/sentry/hybridcloud/models/test_outbox.py::test_drain_shard_not_flush_all__upper_bound` — Changed `Organization(id=1)` to `Organization(id=2)` for `outbox2` — orgs on the same shard coalesce; org id=2 is on shard 2, preventing cross-coalescing
- `tests/sentry/hybridcloud/models/test_outbox.py::test_drain_shard_flush_all__upper_bound` — Replaced `threading.Barrier(2, timeout=1)` with `_PairwiseSync` (semaphore-based, no timeout)

#### Hardcoded IDs causing collisions

- `tests/sentry/integrations/slack/test_sdk_client.py::test_no_integration_found_error` — Changed `integration_id=2` to `integration_id=self.integration.id + 1_000_000`
- `tests/sentry/integrations/azure_devops/test_client.py` — Fixed `uuid4().hex` pop on first use
- `tests/sentry/integrations/github_enterprise/test_client.py` — Same pattern
- `tests/sentry/hybridcloud/models/test_outbox.py::test_cross_db_deletion` — ID collision with existing data; switched to dedicated org factory call

#### Timer/cache expiry

- `tests/sentry/replays/lib/test_cache.py::test_time_limited_cache` — Increased `maxage=1` to `maxage=60` to avoid key expiry on slow CI
- `tests/sentry/digest/test_digest.py::test_large_digest` — Used unique `timeline_key` per test run to avoid collision with concurrent tests

#### Miscellaneous

- `tests/sentry/uptime/test_missing_ok_checks.py::test_missing_ok_checks_around_downtime` — Fixed time boundary calculation
- `tests/sentry/feedback/test_query.py::test_query_recent_feedbacks_with_ai_labels` — Fixed retention timestamp
- `tests/sentry/replays/test_data_export.py::test_export_replay_row_set` — Fixed expired timestamp

### Current state

As of SHA `8f2dd21b0d4`:

- Detect-test-pollution bisection is **re-enabled**
- GitHub issue creation is **disabled**; all reporting goes to `GITHUB_STEP_SUMMARY`
- 8-run green batches have been consistently achieved for all fixed tests
- Remaining flakes are tracked in the TODO table above

### Next steps (if new failures appear)

1. Run `gh run list --repo getsentry/sentry --workflow shuffle-tests-across-shards.yml --limit 8` to check latest batch
2. Download artifacts per step 1 of this skill
3. Check TODO table first — known flakes have root cause notes
4. After Snuba PR #7869 merges: revert `devservices/config.yml` branch pin back to master/nightly so devservices tracks the released image
