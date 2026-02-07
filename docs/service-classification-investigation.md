# Test Service Classification: Investigation & Design

## Goal

Classify Sentry's ~27,000 backend tests by which external services they actually need at runtime, enabling intelligent CI sharding where each shard only starts the services its tests require.

## Current CI State

The `backend-ci` devservices mode starts **7 services** for ALL backend tests:

```yaml
backend-ci: [snuba, postgres, redis, bigtable, redis-cluster, symbolicator, objectstore]
```

Snuba alone brings Clickhouse + Kafka + Redis as transitive dependencies. Starting this stack takes 4-5 minutes per shard.

But the data shows most tests don't need most of these services.

## Test Distribution (origin/master)

| Category                         | Test Files | % of Total |
| -------------------------------- | ---------- | ---------- |
| Total backend test files         | 2,245      | 100%       |
| Need only Postgres               | ~1,774     | ~79%       |
| Need Snuba (+ Clickhouse, Kafka) | ~471       | ~21%       |
| Need Symbolicator                | 8          | <0.5%      |
| Need Kafka (explicit)            | 20         | <1%        |
| Need Objectstore                 | 4          | <0.2%      |
| Need Bigtable                    | 4          | <0.2%      |

**79% of tests could run with just Postgres** - no 4-5 minute Snuba startup required.

## Key Insight: Redis is NOT Implicitly Required

A critical finding: Sentry's default `server.py` configuration uses **dummy/no-op backends** for every subsystem that could use Redis:

| Component        | Default Backend                | Redis needed? |
| ---------------- | ------------------------------ | ------------- |
| Cache (`CACHES`) | `DummyCache`                   | No            |
| Nodestore        | `DjangoNodeStorage` (Postgres) | No            |
| Buffer           | `sentry.buffer.Buffer` (no-op) | No            |
| TSDB             | `DummyTSDB`                    | No            |
| Rate Limiter     | `base.RateLimiter` (disabled)  | No            |
| Digests          | `DummyBackend`                 | No            |

Redis is only needed when tests **explicitly opt in** via direct imports or `override_settings`.

## Detection Methods Available

### Existing Signals in the Codebase

**Test base classes** (defined in `src/sentry/testutils/cases.py`):

- `SnubaTestCase` - has an `autouse=True` fixture that calls `reset_snuba` (HTTP calls to Snuba)
- `BaseMetricsLayerTestCase`, `MetricsEnhancedPerformanceTestCase`, `BaseSpansTestCase`, `SpanTestCase`, `TraceTestCase`, `OurLogTestCase`, `ProfileFunctionsTestCase`, `TraceMetricsTestCase`, `ProfilesSnubaTestCase`, `ReplaysSnubaTestCase`, `OutcomesSnubaTest`, `TraceAttachmentTestCase`, `ReplayEAPTestCase`, `UptimeResultEAPTestCase` - all inherit from or relate to `SnubaTestCase`
- `AcceptanceTestCase` - inherits from `TransactionTestCase`, needs Selenium + Snuba

**Runtime guard fixtures** (defined in `src/sentry/testutils/skips.py`):

- `requires_snuba` - checks if port 1218 is reachable
- `requires_kafka` - checks port 9092
- `requires_symbolicator` - checks port 3021
- `requires_objectstore` - checks port 8888

**Pytest markers** (registered in `pyproject.toml`):

- `@pytest.mark.snuba`
- `@pytest.mark.symbolicator`
- `@pytest.mark.sentry_metrics`

**Directory conventions**:

- `tests/snuba/` - all tests need Snuba
- `tests/symbolicator/` - all tests need Symbolicator
- `tests/relay_integration/` - most need Kafka + Snuba

### Per-Service Signal Counts (origin/master)

**Snuba base classes in test files:**

| Base Class                           | Files |
| ------------------------------------ | ----- |
| `SnubaTestCase`                      | 190   |
| `SpanTestCase`                       | 19    |
| `MetricsEnhancedPerformanceTestCase` | 18    |
| `ReplaysSnubaTestCase`               | 18    |
| `BaseMetricsTestCase`                | 17    |
| `BaseMetricsLayerTestCase`           | 16    |
| `OutcomesSnubaTest`                  | 11    |
| `BaseSpansTestCase`                  | 8     |
| `OurLogTestCase`                     | 8     |
| `ProfilesSnubaTestCase`              | 6     |
| `UptimeResultEAPTestCase`            | 6     |
| `TraceTestCase`                      | 4     |
| `TraceMetricsTestCase`               | 3     |
| Other (1-2 each)                     | ~5    |

**Markers/fixtures:**

| Signal                       | Files |
| ---------------------------- | ----- |
| `requires_snuba`             | 213   |
| `pytest.mark.sentry_metrics` | 91    |
| `pytest.mark.snuba`          | 24    |
| `requires_kafka`             | 20    |
| `requires_symbolicator`      | 8     |
| `pytest.mark.symbolicator`   | 5     |
| `requires_objectstore`       | 4     |

Union of all Snuba signals: **471 unique test files**.

## The Static vs Runtime Analysis Decision

### Can We Statically Determine Snuba Dependencies?

**For ~97% of cases, yes.** Inheritance + markers + directory patterns catch most Snuba-dependent tests.

**For ~3%, no.** The fundamental blocker is **settings-based dispatch**. Sentry uses patterns like:

```python
SENTRY_TSDB = "sentry.tsdb.dummy.DummyTSDB"  # default: no-op

# But a test can do:
@override_settings(SENTRY_TSDB="sentry.tsdb.redissnuba.RedisSnubaTSDB")
def test_something(self):
    tsdb.get_range(...)  # NOW this calls Snuba
```

Whether a code path hits Snuba depends on runtime settings, which can be changed per-test. Tracing this statically in Python requires full program analysis - intractable in the general case.

### The "55 Suspicious Files" Investigation

We found 55 test files in `tests/sentry/` that import from `sentry.snuba` or `snuba_sdk` but aren't marked as needing Snuba. Investigation revealed:

- **~50 files** only import **types and constants** (e.g., `Dataset` enum, `snuba_sdk.Column`, `Referrer`). These are used for query building objects, not execution. They do NOT need Snuba at runtime.
- **~5 files** contain `store_event()` calls that would actually hit Snuba. These are potential misclassifications.

This gives high confidence that the static gap is very small.

### Why Runtime is Better for Snuba Detection

The supposed "single bottleneck" (`_snuba_pool`) is actually **4 distinct HTTP paths** to the same service (127.0.0.1:1218):

1. **`_snuba_pool`** (from `sentry/utils/snuba.py`) - the main urllib3 connection pool, used by `raw_snql_query`, `snuba_rpc`, event stream, attribute updates
2. **Replays EAP transpiler** (`sentry/replays/lib/eap/snuba_transpiler.py`) - creates its **own** `connection_from_url(settings.SENTRY_SNUBA, ...)` pool
3. **`requests.post(settings.SENTRY_SNUBA + ...)`** - used by test fixtures (`reset_snuba`, `OutcomesSnubaTest`, etc.)
4. **Snuba RPC** (`sentry/utils/snuba_rpc.py`) - uses `_snuba_pool` but also has its own retry/error handling layer

Patching `_snuba_pool.urlopen` alone would miss paths #2 and #3. Library-level patching requires tracking 3+ HTTP clients - fragile and incomplete.

**Socket-level monitoring catches all 4 paths with one patch**, because they all connect to the same destination port.

## The Elegant Solution: `getpeername()`

### The Problem with Naive Socket Patching

The initial approach of patching `socket.socket.connect` and maintaining a `socket_id -> destination` mapping has several issues:

1. **Connection pooling**: `connect` is called once per new connection. Pooled connections (urllib3, redis-py) reuse sockets without calling `connect` again.
2. **Socket ID reuse**: Python's `id()` can be recycled after garbage collection. The mapping could associate a new socket with an old destination.
3. **Cleanup**: The mapping dict grows unbounded unless we also patch `socket.close`.
4. **Thread safety**: Background threads (e.g., `reset_snuba` uses `ThreadPoolExecutor`) could make socket calls while our `_current_test` global is stale.

### The Solution

Instead of maintaining a mapping, call `socket.getpeername()` on every `send`/`sendall`:

```python
def _patched_sendall(self, *args, **kwargs):
    try:
        _, port = self.getpeername()[:2]
        service = SERVICE_PORTS.get(port)
        if service and _current_test:
            _test_services[_current_test].add(service)
    except OSError:
        pass
    return _original_sendall(self, *args, **kwargs)
```

This eliminates every concern:

- **Pooling**: `getpeername()` always returns the correct remote address, even on a reused pooled socket
- **Socket ID reuse**: no mapping dict to maintain
- **Cleanup**: nothing to clean up
- **Thread safety**: pytest runs tests sequentially (one test active at a time), so a global `_current_test` is correct. Background threads from the current test still correctly attribute to that test.
- **Performance**: `getpeername()` is a kernel syscall returning cached info - microseconds per call. Acceptable for periodic classification runs.

### C Extension Blind Spots

Two libraries bypass Python's `socket` module entirely:

- **`psycopg2`** (Postgres) - uses `libpq` (C library) for all socket operations
- **`confluent_kafka`** (Kafka) - uses `librdkafka` (C library) for all socket operations

Python socket patching **cannot** detect these. However:

- **Postgres**: virtually every `TestCase` subclass uses it. We treat it as the baseline service and detect it statically.
- **Kafka**: only 20 test files use it, all marked with `requires_kafka`. Static detection has 100% coverage.

## Final Design: Hybrid Runtime + Static

| Service           | Detection                                | Rationale                                                              |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **Snuba**         | Runtime (socket, port 1218)              | 4 distinct HTTP paths, settings-based dispatch risk                    |
| **Redis**         | Runtime (socket, port 6379)              | Implicit usage via `override_settings` swapping `DummyCache` for Redis |
| **Redis Cluster** | Runtime (socket, ports 7000-7005)        | Free since we're already patching sockets                              |
| **Postgres**      | Static (assume all TestCase subclasses)  | psycopg2 uses C sockets; baseline service for ~99% of tests            |
| **Kafka**         | Static (`requires_kafka` fixture)        | confluent_kafka uses C sockets; only 20 files, 100% coverage           |
| **Symbolicator**  | Static (`requires_symbolicator` fixture) | Only 8 files, 100% coverage by fixture                                 |
| **Objectstore**   | Static (`requires_objectstore` fixture)  | Only 4 files, 100% coverage by fixture                                 |
| **Bigtable**      | Static (known file paths)                | Only 4 files                                                           |

## First CI Run Results

Ran the classifier across 22 shards on the full backend suite (32,772 tests). Initial results:

| Service | Tests | % |
|---------|-------|---|
| postgres | 23,682 | 72% |
| redis | 1,478 | 4.5% |
| snuba | 444 | 1.4% |
| kafka | 254 | 0.8% |
| symbolicator | 64 | 0.2% |
| bigtable | 36 | 0.1% |
| objectstore | 13 | <0.1% |
| redis-cluster | 3 | <0.1% |

| Tier | Tests | % |
|------|-------|---|
| postgres_only | 22,337 | 68% |
| no_services | 8,651 | 26% |
| other_services | 1,340 | 4% |
| snuba_tier | 444 | 1.4% |

### Sanity Check Failures

The Snuba count (444) was suspiciously low. Sanity checking revealed:

- 2,329 tests live in `tests/snuba/` directory
- Only 114 of those were detected as needing Snuba
- 2,215 tests in `tests/snuba/` were classified as postgres-only

Investigation showed these tests inherit from `SnubaTestCase` (via `DiscoverSavedQueryBase` etc.), which triggers the `reset_snuba` fixture on every test. This fixture makes HTTP calls to Snuba during setup. However, the tests themselves don't query Snuba in the test body.

### Root Cause: pytest Hook Ordering

The `reset_snuba` fixture runs during **fixture setup**, which happens inside `pytest_runtest_setup`. Our plugin's `pytest_runtest_setup` hook was running **after** pytest's internal one (which triggers fixture setup), so `_current_test` wasn't set when `reset_snuba` made its Snuba HTTP calls.

The 114 tests that WERE detected as needing Snuba likely made Snuba calls during the test body itself (after `_current_test` was set by `pytest_runtest_call`).

### Fix Applied

Added `@pytest.hookimpl(tryfirst=True)` to `pytest_runtest_setup` to ensure our hook runs BEFORE pytest's internal setup (which triggers fixtures). This ensures `_current_test` is set when `reset_snuba` fires.

Also added `@pytest.hookimpl(trylast=True)` to `pytest_runtest_teardown` to clear `_current_test` AFTER fixture teardown completes.

### Other Observations

- **26% of tests (8,651) need no services at all** - these are pure unit tests (parametrized function-level tests without DB access). Our static Postgres detection only catches class-based `TestCase` subclasses and function tests with `db`/`transactional_db` fixtures, so function tests using `@django_db_all` or `@pytest.mark.django_db` may be miscounted.
- **Redis (1,478 tests per shard)** was higher than expected - see "Shard Merge Bug" below.
- **Kafka (254 tests)** detected via static `requires_kafka` markers. Higher than the 20 files we estimated because each file contains multiple tests.

## Second CI Run: Shard Merge Bug

### The Merge Bug

Applied `@pytest.hookimpl(tryfirst=True)` fix and re-ran. Results were identical (444 snuba). Investigation revealed the real issue was in the **merge script**, not the plugin.

Each shard collects ALL 32,772 tests (static detection runs on the full collection), but only RUNS ~1,500 of them (runtime detection). The merge script used assignment (`merged_tests[test_id] = services`) which is **last-write-wins** - the last shard in sorted order (`classification-shard-9`) overwrote all other shards' runtime detections.

Proof: shard-9 reported exactly 444 snuba tests, matching the merged result perfectly.

### Fix: Union Merge

Changed the merge from assignment to set union (`merged_tests[test_id].update(services)`), so a test gets a service if ANY shard detected it.

### Corrected Results (Union Merge on Existing Data)

Applying the union merge to the existing shard data locally revealed a new issue:

| Service | Count | Notes |
|---------|-------|-------|
| redis | 32,772 (100%) | Every test in every shard hits Redis |
| postgres | 23,682 (72%) | Static detection |
| snuba | 9,551 (29%) | Up from 444 - major improvement |
| kafka | 254 | Static detection |
| symbolicator | 64 | Static detection |
| bigtable | 36 | Static detection |
| redis-cluster | 30 | |
| objectstore | 13 | Static detection |

### Redis at 100%: Incidental Service Usage

Every single test that executes shows Redis socket activity. This is **incidental** - likely caused by Django startup code, middleware, or session-level fixtures that ping Redis regardless of what the test does. In CI, Redis is configured as a real backend (not `DummyCache` like in `server.py` defaults).

This is a fundamental limitation of socket-level monitoring: it can't distinguish between "this test NEEDS Redis to function correctly" and "Redis was contacted as a side effect of the test framework." The same likely inflates the Snuba count - `reset_snuba` fires for every `SnubaTestCase` even if the test itself never queries Snuba.

### Implications for Tiered Testing

The runtime classification tells us which tests **use** a service, not which tests **need** it. For tiering decisions:

- **Snuba (9,551 tests / 29%)**: Tests inheriting from `SnubaTestCase` trigger `reset_snuba` (Snuba fixture cleanup) even if they never query Snuba. However, these tests are designed to run with Snuba available, so classifying them as Snuba-tier is conservative and correct.
- **Redis (100%)**: Universal Redis pings mean Redis should be treated as part of the baseline infrastructure in CI, not as a per-test dependency. The question is whether tests would FAIL without Redis - and with `DummyCache` defaults, most would not.
- **Postgres (72%)**: The remaining 28% are function-level parametrized tests without DB access - genuine unit tests.

### Remaining ~71% Postgres-Only

After accounting for Redis as baseline noise, the practical tier split is:
- **~71% of tests**: Only need Postgres (+ Redis as baseline)
- **~29% of tests**: Need Snuba stack
- **<1%**: Need additional services (Symbolicator, Kafka, etc.)

## Redis at 100%: Root Cause Analysis

Investigation into why every test shows Redis activity revealed three causes in the test infrastructure:

### 1. `pytest_runtest_teardown` flushes Redis on every test

In `src/sentry/testutils/pytest/sentry.py`:

```python
def pytest_runtest_teardown(item):
    from sentry.utils.redis import clusters
    with clusters.get("default").all() as client:
        client.flushdb()
```

This runs after **every single test** as defensive cleanup, regardless of whether the test used Redis.

### 2. Test settings override defaults with Redis-backed backends

In `src/sentry/testutils/pytest/sentry.py`, the test configuration overrides `server.py` defaults:

```python
settings.SENTRY_TSDB = "sentry.tsdb.redissnuba.RedisSnubaTSDB"  # server.py default: DummyTSDB
settings.SENTRY_RATELIMITER = "sentry.ratelimits.redis.RedisRateLimiter"  # server.py default: base.RateLimiter (no-op)
settings.SENTRY_OPTIONS["redis.clusters"] = {"default": {"hosts": {0: {"db": TEST_REDIS_DB}}}}
```

Note: `CACHES` IS set to `LocMemCache` (not Redis), so Django cache operations don't hit Redis.

### 3. `clear_caches` autouse fixture

In `tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
def clear_caches():
    yield
    cache.clear()
```

While `CACHES` uses `LocMemCache`, this fixture runs on every test as cleanup.

### Conclusion

Redis is a **baseline CI dependency** due to framework-level cleanup, not because tests need it. For tiering purposes, Redis must be included in every tier. This also means our earlier static analysis finding ("`server.py` defaults to `DummyCache`") was correct about the defaults, but the test settings override them.

## Tiering Decision

### Options Considered

| Tiers | Benefit | Complexity |
|-------|---------|------------|
| **2 tiers** (Postgres+Redis vs Snuba) | Eliminates 4-5min Snuba startup for 71% of tests | Low |
| **3 tiers** (add pure unit test) | Saves ~5s Postgres startup for 26% of tests | Medium, marginal gain |
| **4 tiers** (add Symbolicator) | Avoids starting Symbolicator for 99% of tests | High, ~30s savings for 367 tests |

### Service Startup Costs

| Service | Startup Time |
|---------|-------------|
| Redis | <1s |
| Postgres | ~5s |
| Snuba (+ Clickhouse + Kafka) | ~4-5 min |
| Symbolicator | ~30s |
| Objectstore/Bigtable | ~5-10s each |

The Snuba stack accounts for **95%+ of setup time**. Everything else is seconds. Additional tiers beyond the Snuba split provide diminishing returns with increasing complexity.

### Chosen Approach: Two Tiers

**Tier 1 (~71% of tests)**: Postgres + Redis
- devservices mode: `migrations` (starts postgres + redis)
- Tests that do NOT need Snuba
- Setup time: ~10s

**Tier 2 (~29% of tests)**: Full Snuba stack + everything
- devservices mode: `backend-ci` (current behavior)
- Tests that DO need Snuba (+ Symbolicator, Kafka, etc.)
- Setup time: ~4-5 min

Each tier is independently sharded:
- Tier 1: ~23,221 tests / 1200 per shard = ~20 shards
- Tier 2: ~9,551 tests / 1200 per shard = ~8 shards

Both tiers run in parallel. Wall-clock time is dominated by Tier 2, but Tier 1 finishes much faster, freeing runners sooner.

## First Tiered CI Run

### Results

Tier 2 (Full Snuba stack): **All 9 shards passed.** No issues.

Tier 1 (Postgres + Redis only): **~97% pass rate.** Three categories of failures:

#### Category 1: `requires_snuba` misclassification (setup errors)

Tests using `pytestmark = [requires_snuba]` were not detected by our classifier because `_requires_snuba` was missing from the static detection fixture map. The fixture is session-scoped (runs once), so runtime socket detection didn't catch it either.

**Fix:** Added `_requires_snuba` to `FIXTURE_SERVICE_MAP` in the classifier plugin. These tests now correctly go to Tier 2.

#### Category 2: Redis-cluster tests (setup errors)

Tests parametrized with `[cluster]` (e.g., `TestRedisHashSortedSetBuffer[cluster]`) need Redis-cluster (ports 7000-7005). The `migrations` devservices mode only starts `[postgres, redis]`, not `redis-cluster`.

**Fix:** Start redis-cluster via GitHub Actions `services:` block in Tier 1 (temporary; long-term solution is a new devservices mode `backend-ci-light`).

#### Category 3: Kafka timeouts (test failures)

3-6 tests per shard fail with `KafkaError{code=_MSG_TIMED_OUT}`. These are NOT tests that explicitly need Kafka. They trigger Kafka produces as a side effect of normal application code.

### Deep Dive: Kafka as an Implicit Dependency

#### What is Kafka in this context?

Kafka is a message queue. Sentry's taskworker system uses it to dispatch asynchronous tasks. When application code calls `task.apply_async()`, it produces a message to a Kafka topic. In production, a separate worker (taskbroker) consumes and executes the task. In CI tests, **no consumer runs** - even in the current `backend-ci` mode. The messages go to Kafka and are never read.

#### Why do "simple" tests trigger Kafka?

Django model managers have `post_save`/`post_delete` hooks that call `schedule_invalidate_project_config()`, which wraps `invalidate_project_config.apply_async()` in `transaction.on_commit()`. This fires whenever these common models are saved:

- `ProjectKey` (created in almost every test via fixtures)
- `ProjectOption`
- `OrganizationOption`
- `ReleaseProject`

So any test that creates a project, sets an option, or creates a release triggers a Kafka produce on transaction commit.

#### Why does it timeout instead of failing fast?

The `SingletonProducer` (in `src/sentry/utils/arroyo_producer.py`) tracks up to 1,000 futures. When Kafka is down, all futures fail. Once 1,000 accumulate, the producer blocks on `future.result()` of the oldest future, which times out with `MSG_TIMED_OUT`. Most tests don't hit this limit (< 1,000 Kafka produces per test), but a few long-running tests do.

#### Why not set `TASKWORKER_ALWAYS_EAGER=True`?

Test settings explicitly set `TASKWORKER_ALWAYS_EAGER = False` (in `src/sentry/testutils/pytest/sentry.py`). This is deliberate because:

- Tests use `BurstTaskRunner` to control when tasks execute. `TASKWORKER_ALWAYS_EAGER=True` would bypass this, executing tasks immediately and changing execution order.
- Some tests assert tasks were queued but NOT executed.
- `TaskRunner()` context manager sets `ALWAYS_EAGER=True` when tests explicitly want synchronous execution.

Setting it to `True` globally would change test behavior and could introduce false passes/failures.

### Kafka Resolution: Mock Approach (Tried and Rejected)

Initially tried mocking `SingletonProducer.produce` to return immediately-resolved futures. This fixed the Kafka timeout failures but introduced new problems:

1. **Broke tests that mock Kafka producers themselves.** Tests like `test_emit_click_events_environment_handling` use `mock.patch("arroyo.backends.kafka.consumer.KafkaProducer.produce")` and assert the mock was called. Our higher-level mock on `SingletonProducer.produce` intercepted calls before they reached the test's own mock, causing `assert producer.called` to fail.

2. **Caused thread leak detection changes.** `test_capture_event_allowlisted` expected thread leak level `info` but got `warning`, likely because our mock changed the threading behavior (Kafka producer threads that normally exist were absent).

3. **Caused task registration failures.** `test_taskworker_schedule_parameters` couldn't find `sentry.tasks.send_ping`, possibly due to different initialization paths.

**Lesson learned:** Mocking infrastructure at a high level is fragile. Tests that mock the same infrastructure at a different level will conflict. The mock approach has a fundamental composability problem.

### Kafka Resolution: Services Block (Chosen)

Switched to starting real Kafka + Zookeeper via GitHub Actions `services:` block:

```yaml
services:
  zookeeper:
    image: ghcr.io/getsentry/image-mirror-confluentinc-cp-zookeeper:6.2.0
    env:
      ZOOKEEPER_CLIENT_PORT: 2181
  kafka:
    image: ghcr.io/getsentry/image-mirror-confluentinc-cp-kafka:6.2.0
    env:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://127.0.0.1:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_OFFSETS_TOPIC_NUM_PARTITIONS: 1
    ports:
      - 9092:9092
```

This approach:
- Provides real Kafka infrastructure (~10-15s startup)
- Zero behavioral differences from current `backend-ci` CI
- No mocking conflicts with test-level mocks
- Already proven in the Relay repo's CI
- `services:` containers start before any steps, so Kafka is ready before `sentry init`

**Tradeoffs considered:**

| Approach | Startup Cost | Risk | Production-ready? |
|----------|-------------|------|-------------------|
| Mock `SingletonProducer.produce` | 0s | Conflicts with test mocks, behavioral drift | No - rejected |
| Kafka via `services:` block | ~10-15s | None (real infrastructure) | Yes - chosen |
| `TASKWORKER_ALWAYS_EAGER=True` | 0s | Changes task execution behavior, bypasses BurstTaskRunner | No - rejected |

## Remaining Tier 1 Failures: Environment-Dependent Tests

After fixing the Kafka issue (services block), the split script (tier2_services), and the `_requires_snuba` static detection, 3 tests still failed in Tier 1. All were caused by differences between the `migrations` and `backend-ci` devservices modes, not by missing service dependencies.

### `test_taskworker_schedule_parameters` (Fixed)

**Root cause:** The test iterates `TASKWORKER_SCHEDULES` and calls `taskregistry.get_task()` for each, but doesn't use the `load_tasks` fixture that imports task modules. In `backend-ci` mode, tasks happen to be imported by other tests or the heavier initialization path. In `migrations` mode, the lighter initialization doesn't import them, exposing the missing fixture.

**Fix:** Added `load_tasks` fixture to the test (same as sibling test `test_taskworker_schedule_type`). This is a pre-existing test bug that worked by accident in `backend-ci` mode.

### `test_capture_event_allowlisted` and `test_capture_event_strict_no_allowlist` (Force Tier 2)

**Root cause:** These thread leak detection tests assert specific Sentry event levels (`info` for allowlisted, `error` for strict). They get `warning` instead in `migrations` mode.

The `event_from_stack()` function correctly sets the level. But `capture_event()` uses a cached scope (`@functools.cache` on `get_scope()`) that forks from `sentry_sdk.get_current_scope()`. The scope state at first call differs between modes - in `migrations` mode, the lighter initialization leaves the scope in a different state that causes `scope.capture_event()` to override the event level.

**Resolution:** Added to `FORCE_TIER2_FILES` list in the split script. These tests test internal test infrastructure (not application code) and are inherently sensitive to the test environment. Running them with full services is appropriate.

### The `FORCE_TIER2_FILES` Pattern

For tests that can't be automatically classified and fail due to environment differences (not service dependencies), the split script maintains a `FORCE_TIER2_FILES` set. This is a small, documented escape hatch. Currently contains 1 file (2 tests). Should be reviewed periodically to see if the underlying issues have been fixed.

## Validation

The classification can be validated empirically: run Tier 1 tests with only the Tier 1 services. Any test that fails reveals a misclassification. The `requires_*` fixtures provide built-in fail-fast guards for their respective services.

## pytest-xdist Investigation

### Feasibility

- **94.8%** of Tier 2 tests (10,186 of 10,742) use regular `TestCase` (transaction rollback) - xdist-safe from a DB perspective
- **5.2%** (556 tests) use `TransactionTestCase` (flush DB) - but with xdist each worker gets its own database, so DB flushing only affects the worker's own DB. Not a problem.
- **Snuba is shared** across all xdist workers - the main isolation concern. Using `--dist=loadfile` groups all tests from the same file on one worker, minimizing cross-contamination.

### Obstacles Encountered and Resolved

#### 1. Non-deterministic test collection (`PYTEST_XDIST_TESTRUNUID`)

xdist requires all workers to collect identical test lists. Sentry generates a random region name in `_configure_test_env_regions()` which can affect test parametrization. Each worker generated a different name, causing "Different tests were collected between gw0 and gw1" errors.

**Fix:** Use `PYTEST_XDIST_TESTRUNUID` (shared across all workers per session) as a deterministic seed for the region name random generator. The name still changes per run but is consistent across workers.

#### 2. Leftover `transaction_test` marker

A previous PoC left `@pytest.mark.transaction_test` marker code in `sentry.py` without registering the marker in `pyproject.toml`. In normal runs this produces a warning, but xdist treats unregistered markers as errors during collection, crashing workers with `INTERNALERROR`.

**Fix:** Removed the leftover marker code.

#### 3. pytest-rerunfailures socket timeout with xdist

`pytest-rerunfailures` creates a TCP socket server/client when xdist is detected, used for crash recovery (segfault reruns). This causes `TimeoutError: timed out` on `conn.recv(1)` in every run. Tested with both v15.0 and v16.1 - same result.

**Root cause deep dive:** The socket communication is gated by `HAS_PYTEST_HANDLECRASHITEM` in `pytest_configure`. When xdist is present AND the xdist version supports `pytest_handlecrashitem`, rerunfailures creates:
- Master: `ServerStatusDB` - TCP socket server on localhost
- Workers: `ClientStatusDB` - TCP client connecting to master

The socket tracks rerun counts per test for crash recovery. The timeout likely comes from:
- `localhost` resolving to different IP families (IPv4/IPv6) on server vs client
- Possible interference with our `socket.send`/`sendall` patches from the service classifier plugin
- Single-byte `recv(1)` protocol being fragile under load

**Critical insight:** The socket is ONLY needed for crash recovery (segfault/SIGKILL reruns). Normal `--reruns` works without it - each xdist worker handles retries locally via the `pytest_runtest_protocol` hook's `while need_to_run` loop. Disabling the socket only loses the ability to rerun tests that kill the entire worker process.

**Fix:** Set `pytest_rerunfailures.HAS_PYTEST_HANDLECRASHITEM = False` in `tests/conftest.py`. This forces rerunfailures to use the in-memory `StatusDB()` instead of the socket-based one. Normal reruns continue working.

#### 4. Non-deterministic parametrize ordering (`PYTHONHASHSEED`)

Even with the region name fix, workers collected different test lists due to parametrized tests whose values come from dicts/sets. Python's hash randomization causes different iteration order per process.

**Fix:** Set `PYTHONHASHSEED=0` in the workflow to ensure deterministic hash ordering across all workers.

### First xdist CI Run Results

With obstacles 1-4 resolved, xdist ran successfully with `-n2 --dist=loadfile`:

- **1,400-1,500 tests passed per shard** (same as baseline)
- **2-5 failures per shard** (Snuba data contamination + snowflake collisions)
- **59-66 reruns per shard** (reruns working via `HAS_PYTEST_HANDLECRASHITEM=False`)
- **11-13 min per shard** vs baseline ~17 min (~25-35% speedup)

### Failure Categories

**1. Snuba data contamination (most failures):**
Worker A's `reset_snuba` calls `TRUNCATE TABLE` on shared Clickhouse tables, wiping worker B's data mid-test. Examples: `test_in_query_events` (missing events), `test_top_events_*` (wrong counts).

**2. Snowflake ID collisions:**
Workers share Redis, causing concurrent snowflake ID generation to collide. Error: `MaxSnowflakeRetryError: Max allowed ID retry reached`. Affects Organization/Project/Team ID generation.

**3. Shared state race conditions:**
Rate limiter state, integration pipeline state shared across workers.

### The Fundamental Snuba Isolation Problem

**Why `reset_snuba` exists:** Snuba/Clickhouse has no transaction rollback. When `store_event()` writes to Clickhouse, that data persists even after Django rolls back Postgres. Tests within the same class reuse the same project (created in `setUp`), so test B would see test A's stale events without cleanup. `reset_snuba` TRUNCATEs all tables before each test to ensure a clean slate.

**Why this breaks xdist:** `TRUNCATE TABLE` is table-wide. Worker gw0's reset wipes gw1's data. There's no project-scoped cleanup endpoint in Snuba.

**Why we can't just skip `reset_snuba`:** Tests within a class share the same project_id (from `setUp`). Without cleanup, `test_no_events` would see leftover events from `test_with_event` in the same class, because both query the same project_id and Clickhouse doesn't roll back.

**Why unique IDs alone don't solve it:** Unique IDs across workers prevent cross-worker contamination. But within a single worker, consecutive test methods on the same `setUp` project still need cleanup between tests.

### Solution: Project-Scoped Snuba Cleanup

The path forward requires changing `reset_snuba` from `TRUNCATE TABLE` (wipes everything) to `DELETE WHERE project_id IN (...)` (wipes only the current worker's data).

**Snuba side:** Add a new test endpoint `/tests/{dataset}/delete?project_id=X` that uses Clickhouse lightweight deletes (`DELETE WHERE project_id = X`). Snuba already has `delete_from_storage()` infrastructure for this. Estimated ~20 lines of code.

**Sentry side:**
1. Change `reset_snuba` to call the new project-scoped endpoint instead of the TRUNCATE endpoint
2. Track which project_ids the current worker has used
3. Prefix snowflake Redis keys with xdist worker ID to prevent ID collisions
4. Offset Postgres auto-increment sequences per worker so IDs are globally unique

**Alternative (no Snuba changes):** If ALL tests created fresh projects for each test method (not just in `setUp`), we could skip `reset_snuba` entirely. But many test classes share projects across methods, making this impractical without a large test refactor.

### Snowflake ID Fix

Three models use snowflake IDs (Organization, Project, Team) via Redis-backed counters. Under xdist, workers share Redis and collide on the counter keys.

**Fix:** Prefix the Redis key with the xdist worker ID:
- Current: `snowflakeid:project_snowflake_key:{timestamp}`
- Under xdist: `snowflakeid:gw0:project_snowflake_key:{timestamp}`

This keeps snowflake testing enabled while preventing cross-worker collisions. No changes needed when running without xdist.

### xdist Summary

| What | Status |
|------|--------|
| Test collection consistency | Solved (TESTRUNUID seed + PYTHONHASHSEED=0) |
| pytest-rerunfailures compatibility | Solved (HAS_PYTEST_HANDLECRASHITEM=False) |
| Snuba data isolation | **Requires Snuba API change** (project-scoped delete) |
| Snowflake ID collisions | Requires worker-prefixed Redis keys |
| Performance with -n2 | ~25-35% speedup (11-13 min vs 17 min baseline) |

xdist is promising but requires a small Snuba API addition for production use. The tiered approach works today without any cross-repo changes.

## Expected Impact

**Tiered CI (working today):** ~68% of backend tests run with lighter services (setup ~15-20s vs ~2.5-3 min). Same 22 shards, same runner resources.

**xdist (future, requires Snuba change):** Additional ~25-35% speedup within each shard via 2-worker parallelism. Combined with tiering, could reduce total CI wall-clock time significantly.
