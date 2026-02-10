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

| Service       | Tests  | %     |
| ------------- | ------ | ----- |
| postgres      | 23,682 | 72%   |
| redis         | 1,478  | 4.5%  |
| snuba         | 444    | 1.4%  |
| kafka         | 254    | 0.8%  |
| symbolicator  | 64     | 0.2%  |
| bigtable      | 36     | 0.1%  |
| objectstore   | 13     | <0.1% |
| redis-cluster | 3      | <0.1% |

| Tier           | Tests  | %    |
| -------------- | ------ | ---- |
| postgres_only  | 22,337 | 68%  |
| no_services    | 8,651  | 26%  |
| other_services | 1,340  | 4%   |
| snuba_tier     | 444    | 1.4% |

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

| Service       | Count         | Notes                                |
| ------------- | ------------- | ------------------------------------ |
| redis         | 32,772 (100%) | Every test in every shard hits Redis |
| postgres      | 23,682 (72%)  | Static detection                     |
| snuba         | 9,551 (29%)   | Up from 444 - major improvement      |
| kafka         | 254           | Static detection                     |
| symbolicator  | 64            | Static detection                     |
| bigtable      | 36            | Static detection                     |
| redis-cluster | 30            |                                      |
| objectstore   | 13            | Static detection                     |

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

| Tiers                                 | Benefit                                          | Complexity                       |
| ------------------------------------- | ------------------------------------------------ | -------------------------------- |
| **2 tiers** (Postgres+Redis vs Snuba) | Eliminates 4-5min Snuba startup for 71% of tests | Low                              |
| **3 tiers** (add pure unit test)      | Saves ~5s Postgres startup for 26% of tests      | Medium, marginal gain            |
| **4 tiers** (add Symbolicator)        | Avoids starting Symbolicator for 99% of tests    | High, ~30s savings for 367 tests |

### Service Startup Costs

| Service                      | Startup Time |
| ---------------------------- | ------------ |
| Redis                        | <1s          |
| Postgres                     | ~5s          |
| Snuba (+ Clickhouse + Kafka) | ~4-5 min     |
| Symbolicator                 | ~30s         |
| Objectstore/Bigtable         | ~5-10s each  |

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

| Approach                         | Startup Cost | Risk                                                      | Production-ready? |
| -------------------------------- | ------------ | --------------------------------------------------------- | ----------------- |
| Mock `SingletonProducer.produce` | 0s           | Conflicts with test mocks, behavioral drift               | No - rejected     |
| Kafka via `services:` block      | ~10-15s      | None (real infrastructure)                                | Yes - chosen      |
| `TASKWORKER_ALWAYS_EAGER=True`   | 0s           | Changes task execution behavior, bypasses BurstTaskRunner | No - rejected     |

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

| What                               | Status                                                |
| ---------------------------------- | ----------------------------------------------------- |
| Test collection consistency        | Solved (TESTRUNUID seed + PYTHONHASHSEED=0)           |
| pytest-rerunfailures compatibility | Solved (HAS_PYTEST_HANDLECRASHITEM=False)             |
| Snuba data isolation               | **Requires Snuba API change** (project-scoped delete) |
| Snowflake ID collisions            | Requires worker-prefixed Redis keys                   |
| Performance with -n2               | ~25-35% speedup (11-13 min vs 17 min baseline)        |

## xdist Progress Log

### Iteration 1: loadgroup (all snuba tests on one worker)

- Used `--dist=loadgroup` to serialize all snuba tests onto a single xdist worker
- **Result**: 43 unique failures — cross-worker ClickHouse contamination from non-snuba tests writing via `store_event()` → `SnubaEventStream._send()`

### Iteration 2: \_send mock (prevent non-snuba CH writes)

- Mocked `SnubaEventStream._send` and `_send_item` for non-snuba tests
- Added file-level import scanning to detect implicit snuba dependencies
- **Result**: 60 unique failures — worse. Mock was too aggressive, broke tests that implicitly needed CH. Detection was imperfect.

### Iteration 3: Two-phase approach (current working solution)

- Phase 1: non-snuba tests with xdist `-n 2 --dist=loadfile`
- Phase 2: snuba tests single-threaded (identical to normal CI)
- **Result**: 22/22 green after fixing snowflake test (`test_snowflake.py` hardcoded `region_snowflake_id=0`)
- **Timing**: Phase 1 ~5.5 min (1100 tests), Phase 2 ~8 min (350 tests), total ~14 min
- **Speedup**: ~18% (14 min vs 17 min baseline) — Phase 2 bottleneck limits gains

### Iteration 4: Three-phase approach (next)

**Key finding**: Not all "snuba tests" are equal.

| Category                                                                     | Files | What they do                                     | Needs TRUNCATE?             |
| ---------------------------------------------------------------------------- | ----- | ------------------------------------------------ | --------------------------- |
| `SnubaTestCase` + metrics + replays                                          | ~200  | Write to AND read from ClickHouse                | Yes (autouse `reset_snuba`) |
| `requires_snuba` only (no SnubaTestCase)                                     | ~185  | Write to CH via `store_event()`, never read      | No                          |
| 3 edge cases (`test_reprocessing2`, `test_minidump_full`, `test_attributes`) | 3     | Use `reset_snuba` directly without SnubaTestCase | Yes                         |
| Non-snuba tests                                                              | ~1849 | No CH interaction                                | No                          |

The ~185 `requires_snuba`-only tests need Snuba _running_ (for eventstream writes to succeed) but never query ClickHouse. Without `reset_snuba`, no TRUNCATE happens, so they're safe for parallel execution.

**Plan**:

- Phase 1 (`-n 4`): Non-snuba tests — no CH interaction
- Phase 2 (`-n 4`): `requires_snuba`-only tests — write to CH but never read, no TRUNCATE
- Phase 3 (serial): True CH readers — `SnubaTestCase`, metrics, replays, + 3 edge cases

**Projected timing** (4 workers):

- Phase 1: ~1849 files / 4 workers ≈ 2-3 min
- Phase 2: ~185 files / 4 workers ≈ 1 min
- Phase 3: ~200 files, serial ≈ 3-5 min
- Total: ~6-9 min (vs 17 min baseline = 47-65% speedup)

### Iteration 5: Approach 2 — skip TRUNCATE entirely (REJECTED)

**Hypothesis:** If all ClickHouse queries were properly project-scoped, `reset_snuba` would be
unnecessary (each test creates unique snowflake IDs, queries filter by `project_id`). Skip
`TRUNCATE TABLE` via env var `XDIST_SKIP_SNUBA_RESET=1` and fix individual tests with broad
aggregations.

**Implementation:**

1. Added conditional skip in `reset_snuba` fixture: `if os.environ.get("XDIST_SKIP_SNUBA_RESET"): return`
2. Fixed `test_common.py` to scope `GetActiveOrgsVolumes` calls with `orgs=[org.id]`
3. Ran all tests in a single xdist phase with `-n 2 --dist=loadfile`

**Result: 50+ failures across all 22 shards.** Every shard failed.

Earlier estimates (~14 failures) were from a two-phase run where most non-snuba tests didn't
write to ClickHouse. Running ALL tests in parallel without TRUNCATE dramatically amplified
cross-contamination because the full test suite produces far more ClickHouse writes.

**Failure categories:**

| Category | Failures | Root Cause |
| --- | --- | --- |
| ClickHouse data accumulation | ~35 | Metrics/event data from other workers inflates counts. Values are multiples of expected (e.g., 21000 == 3000, 84M == 12M). Queries across ~15 test files lack tight project/org scoping. |
| Relay container conflicts | ~6 | Docker container `sentry_test_relay_server` has a fixed name. Two xdist workers creating it simultaneously → 409 Conflict. All show `assert None is not None`. |
| Event frequency percent conditions | ~5 | ClickHouse event counts inflated by other workers' events within time windows. |
| Rule preview KeyErrors | 3 | Group IDs from other workers appear in ClickHouse query results, causing KeyError lookups against Postgres (which rolled back those groups). |
| Foreign key integrity errors | 1 | Org created by one worker rolled back in Postgres while ClickHouse still references it. |
| Report test failures | 2 | Stale ClickHouse data causes wrong event counts/group IDs in report generation. |

**Affected test files (ClickHouse accumulation):**

- `test_organization_release_health_data.py` (~12 failures)
- `test_api.py` (sentry_metrics querying, ~10 failures)
- `test_metrics_enhanced_performance.py` (~7 failures)
- `test_boost_low_volume_transactions.py` (2)
- `test_tasks.py` (dynamic sampling, 4)
- `test_common.py` (2, despite our fix — other queries still broad)
- `test_release_health.py` (metrics layer, 2)
- `test_boost_low_volume_projects.py`, `test_metrics.py`, `test_organization_events_histogram.py`,
  `test_organization_events_trends.py`, `test_organization_root_cause_analysis.py`,
  `test_organization_replay_index.py`, `test_preview.py`, `test_daily_summary.py`,
  `test_weekly_reports.py` (1-3 each)

**Conclusion:** Approach 2 is **not viable at this scale.** The number of ClickHouse queries that
aren't perfectly project-scoped is far larger than initial estimates suggested. Fixing 50+ tests
across 15+ files would be a major refactoring effort with ongoing maintenance burden (any new test
that queries ClickHouse broadly would break). The two-phase approach (Iteration 3) remains the
correct xdist strategy.

**The Relay container naming conflict is a separate blocker** that would need to be solved
independently (e.g., per-worker container names, or a shared Relay instance with proper isolation).

### Iteration 3 (restored): Two-phase approach (current working solution)

Reverted to the proven two-phase strategy:

- Phase 1: non-snuba tests with xdist `-n 3 --dist=loadfile`
- Phase 2: snuba tests single-threaded (identical to normal CI)
- Result: 22/22 green (validated in earlier runs)

## Combining Tiered CI + xdist: The Complete Strategy

### How the two strategies complement each other

**Tiered CI** and **xdist** solve different problems and can be combined for maximum benefit:

| Strategy | What it optimizes | Mechanism |
| --- | --- | --- |
| **Tiered CI** | Eliminates unnecessary service startup | 71% of tests skip Snuba stack (~4-5 min saved per shard) |
| **xdist** | Parallelizes test execution within a shard | Multiple tests run concurrently on the same runner |

These are orthogonal — tiered CI decides **which services to start**, xdist decides **how to run tests within a shard**.

### Combined architecture

```
Tier 1 (Postgres + Redis + Kafka, ~71% of tests):
  - devservices mode: migrations (~15-20s setup)
  - xdist: -n 3 --dist=loadfile (all tests are non-snuba, safe for parallel)
  - Shards: 6
  - Expected time: ~4-6 min per shard (vs ~12 min without xdist)

Tier 2 (Full Snuba stack, ~29% of tests):
  - devservices mode: backend-ci (~4-5 min setup)
  - Two-phase execution within each shard:
    - Phase 1: non-snuba tests in this shard with xdist -n 3
    - Phase 2: snuba tests single-threaded
  - Shards: 16
  - Expected time: ~10-14 min per shard (setup + two phases)
```

### Why this is optimal

1. **Tier 1 benefits fully from xdist.** Since no tests need Snuba, there's no TRUNCATE conflict —
   all tests can run in parallel. The 4-5 min Snuba startup is completely eliminated. Combined with
   3x parallelism, Tier 1 shards should complete in ~4-6 min total.

2. **Tier 2 benefits partially from xdist.** Within each Tier 2 shard, the ~71% of tests that don't
   need Snuba (but were placed in Tier 2 shards due to the per-shard test distribution) can still
   run in parallel in Phase 1. Only the Snuba-dependent tests must run single-threaded in Phase 2.

3. **No additional runner cost.** The total shard count stays at 22 (6 + 16). Tier 1 shards finish
   faster and free up runners sooner.

### Projected combined impact

| Configuration | Tier 1 wall-clock | Tier 2 wall-clock | Overall wall-clock |
| --- | --- | --- | --- |
| Baseline (current CI) | N/A (single tier) | N/A | ~17 min |
| Tiered only | ~12 min | ~18 min | ~18 min (Tier 2 bottleneck) |
| xdist only (two-phase) | N/A | N/A | ~14 min |
| **Tiered + xdist** | **~5 min** | **~12 min** | **~12 min** |

The combined approach targets a ~30% reduction in wall-clock time while using the same number of
runners. Tier 1 finishes much faster, freeing 6 runners for other CI jobs.

### Implementation path

1. **Tiered CI (ready):** Workflow at `backend-tiered-poc.yml` with classification-based splitting.
   Validated with all shards green. Needs final production integration.

2. **xdist for Tier 1 (straightforward):** Add `-n 3 --dist=loadfile` + `PYTHONHASHSEED=0` to
   Tier 1 shards. No phase splitting needed since all tests are non-snuba.

3. **xdist for Tier 2 (current POC):** Two-phase approach within each shard. Already validated
   at `backend-xdist-poc.yml`. Integrate `--xdist-snuba-phase` into the tiered workflow.

### What was tried and ruled out

| Approach | Why rejected |
| --- | --- |
| Skip TRUNCATE entirely (Approach 2) | 50+ failures from unscoped ClickHouse queries. Not viable without major test refactoring. |
| Three-phase split (writes vs reads) | Marginal gain over two-phase. Classification complexity not worth the 1-2 min savings. |
| Mock SnubaEventStream._send | Broke tests with implicit Snuba dependencies. Fragile. |
| loadgroup (all snuba on one worker) | Cross-worker contamination from non-snuba tests that write to CH via store_event(). |
| Per-worker ClickHouse instances | Infeasible — Snuba manages CH lifecycle, can't easily spin up N instances. |
| Project-scoped Snuba delete API | Requires Snuba-side changes. Clean but blocked on cross-team work. Best long-term solution. |

## Classification Strategy Comparison: `_needs_snuba()` vs Runtime Socket Monitoring

We have two approaches to classify tests by service dependency. Here's a detailed comparison.

### `_needs_snuba()` — Static, marker/class-based classification

**Mechanism:** Inspects pytest markers (`@pytest.mark.snuba`), fixtures (`requires_snuba`, `requires_kafka`), and class hierarchy (`RelayStoreHelper` inheritance) at collection time. No test execution required.

| Aspect | Details |
| --- | --- |
| **Granularity** | Per-test (individual test methods) |
| **Cost** | Zero — runs during pytest collection, <1s |
| **Accuracy** | ~97% (misses `override_settings`-based dispatch, ~5 files) |
| **Maintenance** | Self-maintaining — new tests that inherit from `SnubaTestCase` or use `requires_snuba` are automatically classified |
| **Artifacts** | None — classification happens inline during the test run |
| **Implementation** | ~25 lines of Python in `sentry.py`, already integrated via `--xdist-snuba-phase` |

**What it catches:**
- `@pytest.mark.snuba` (on `SnubaTestCase` and subclasses)
- `@requires_snuba` / `@requires_kafka` (usefixtures markers)
- `pytestmark = [requires_snuba]` (module-level)
- `RelayStoreHelper` subclasses (read from ClickHouse via `eventstore`)

**What it misses:**
- Tests that hit Snuba purely through `override_settings` swapping a DummyBackend for a Snuba-backed one (~5 files, <0.5%)
- Tests that call Snuba indirectly through deep call chains without any marker

### Runtime Socket Monitoring — Empirical, connection-based classification

**Mechanism:** Patches `socket.sendall` to call `getpeername()` on every network send, recording which ports (services) each test contacts. Runs as a pytest plugin during actual test execution across all 22 shards.

| Aspect | Details |
| --- | --- |
| **Granularity** | Per-test (individual test methods), aggregated per-file |
| **Cost** | Operational — requires a dedicated CI workflow (`classify-services.yml`), artifact upload/download, merge script |
| **Accuracy** | ~100% for Python sockets; blind to C extensions (psycopg2, confluent_kafka) |
| **Maintenance** | Classification JSON must be regenerated periodically; merge script had bugs (last-write-wins) |
| **Artifacts** | JSON file (`test-service-classification.json`), split script, merge script |
| **Implementation** | ~200 lines across `service_classifier.py`, `classify-services.yml`, `split-tests-by-tier.py` |

**What it catches:**
- All Snuba HTTP calls (4 distinct paths) via port 1218
- Redis connections via port 6379
- Redis-cluster via ports 7000-7005
- Any other Python-socket-based service communication

**What it misses:**
- Postgres (psycopg2 uses C sockets via libpq)
- Kafka (confluent_kafka uses C sockets via librdkafka)
- Incidental service contact (Redis at 100% due to framework cleanup in teardown)

### Recommendation: `_needs_snuba()` for the Combined Strategy

For the combined tiered + xdist approach, `_needs_snuba()` is the better foundation because:

1. **Zero operational overhead.** No classification workflow, no JSON artifacts, no split scripts, no artifact upload/download steps. The classification happens inline during pytest collection.

2. **Directly addresses the TRUNCATE concern.** The primary reason for tiering is Snuba isolation. `_needs_snuba()` was designed specifically to identify tests that interact with ClickHouse (the `TRUNCATE TABLE` problem). Runtime socket monitoring detects *usage*, not *need* — leading to over-classification (e.g., Redis at 100%).

3. **Proven reliability for xdist.** The two-phase xdist approach (22/22 shards green) uses `_needs_snuba()` via `--xdist-snuba-phase`. The same function can drive tiering decisions with no additional code.

4. **Lower maintenance.** New Snuba tests that follow conventions (inherit from `SnubaTestCase`, use `requires_snuba`) are automatically classified. No need to re-run a classification workflow.

5. **Simpler architecture.** The combined workflow needs only `--xdist-snuba-phase` to split tests — the tiered POC's `split-tiers` job, artifact passing, and `SELECTED_TESTS_FILE` mechanism are all eliminated.

The ~3% gap (tests that hit Snuba via `override_settings` without markers) is acceptable because:
- These tests would fail fast in Tier 1 (no Snuba running), making misclassifications immediately visible
- The `FORCE_TIER2_FILES` escape hatch can handle edge cases if needed
- In practice, the xdist two-phase approach has been validated at 22/22 green with this classification

## Combined Strategy v2: `_needs_snuba()` + Tiered CI + xdist

### Architecture

The key insight is that `_needs_snuba()` replaces the entire classification pipeline. Instead of:

```
classify-services.yml → JSON artifact → split-tests-by-tier.py → SELECTED_TESTS_FILE → pytest
```

We get:

```
pytest --xdist-snuba-phase=exclude/only → _needs_snuba() deselects at collection time
```

This eliminates the split-tiers job, artifact passing, and file-based test selection entirely.

### Workflow Design (backend-combined-poc.yml)

**Tier 1: Non-Snuba tests (4 shards)**
- `MATRIX_INSTANCE_TOTAL=4` (hash-distributes ALL tests into 4 groups)
- `--xdist-snuba-phase=exclude` (deselects Snuba tests at collection time)
- `-n 2 --dist=loadfile` (xdist parallelism — safe because no TRUNCATE conflict)
- devservices mode: `migrations` (Postgres + Redis, ~10-15s setup)
- Services block: redis-cluster, kafka, zookeeper (same as tiered POC)
- Each shard runs ~1/4 of non-Snuba tests ≈ 5,500 tests
- With xdist -n2: ~10-12 min per shard

**Tier 2: Snuba tests (18 shards)**
- `MATRIX_INSTANCE_TOTAL=18` (hash-distributes ALL tests into 18 groups)
- `--xdist-snuba-phase=only` (deselects non-Snuba tests at collection time)
- Single-threaded (all tests need Snuba → TRUNCATE TABLE prevents parallelism)
- devservices mode: `backend-ci` (full Snuba stack, ~4-5 min setup)
- Each shard runs ~1/18 of Snuba tests ≈ 555 tests
- ~9-14 min per shard (including setup)

**Total runners: 22** (same as current backend CI)

### Why tests don't overlap or get missed

Each test is hash-distributed independently in each tier:
- In Tier 1: `hash(nodeid) % 4` assigns each test to one of 4 shards. The phase filter then deselects Snuba tests. Result: each non-Snuba test runs in exactly one Tier 1 shard.
- In Tier 2: `hash(nodeid) % 18` assigns each test to one of 18 shards. The phase filter then deselects non-Snuba tests. Result: each Snuba test runs in exactly one Tier 2 shard.
- Non-Snuba tests assigned to Tier 2 shards are deselected (never run there).
- Snuba tests assigned to Tier 1 shards are deselected (never run there).
- Every test runs exactly once, in the correct environment.

### Projected Performance

| Metric | Tier 1 (4 shards) | Tier 2 (18 shards) |
| --- | --- | --- |
| Tests per shard | ~5,500 | ~555 |
| xdist workers | 2 | 1 (single-threaded) |
| Setup time | ~15s (migrations) | ~4-5 min (backend-ci) |
| Test execution | ~10-12 min | ~9-10 min |
| Total shard time | ~10-12 min | ~13-15 min |

**Wall-clock time: ~13-15 min** (dominated by Tier 2 setup + execution). Tier 1 finishes first, freeing 4 runners for other CI jobs.

Compared to:
- Current CI: ~17 min
- xdist-only (two-phase): ~14 min
- Tiered-only (runtime classification): ~18 min (Tier 2 bottleneck from smaller shard count)
- **Combined: ~13-15 min** with better resource utilization

## Making Snuba Tests Faster: Three Levels of Optimization

### Level 1: Two-Group xdist Split (Sentry-only, implemented)

**Key insight:** Not all Snuba tests trigger `TRUNCATE TABLE`. Only tests that use `reset_snuba`
(via `SnubaTestCase`'s autouse fixture or explicit `@pytest.mark.usefixtures("reset_snuba")`) do.
Tests with only `requires_snuba` write to ClickHouse but never read from it and never TRUNCATE.

**Classification function: `_triggers_snuba_reset(item)`**

Returns True if:
1. `@pytest.mark.snuba` — SnubaTestCase and all subclasses (~200 files)
2. `@pytest.mark.usefixtures("reset_snuba")` — explicit opt-in (ProfilesSnubaTestCase, etc.)
3. `RelayStoreHelper` in MRO — reads from ClickHouse via eventstore

Everything else (~85% of all tests) is safe for xdist parallelism.

**Workflow:** `backend-xdist-split-poc.yml` — two job groups, same `backend-ci` environment:

| Group | Shards | xdist | Tests | Why safe |
| --- | --- | --- | --- | --- |
| parallel | 6 | `-n 3 --dist=loadfile` | ~85% (non-TRUNCATE) | No TRUNCATE TABLE → no cross-worker data wipes |
| serial | 16 | single-threaded | ~15% (TRUNCATE) | TRUNCATE is table-wide → must serialize |

CLI: `--xdist-group=parallel` or `--xdist-group=serial`

### Level 2: Project-Scoped Cleanup (requires small Snuba change)

Replace `TRUNCATE TABLE` (wipes everything) with `DELETE WHERE project_id IN (...)` (wipes only
the current test's data). Each test already creates objects with unique snowflake IDs, so data is
uniquely identifiable.

**Snuba change (~5-10 lines per endpoint):** Add optional `project_id` param to `/tests/{dataset}/drop`:

```python
project_ids = request.args.get("project_id")
if project_ids:
    clickhouse.execute(f"ALTER TABLE {table} DELETE WHERE project_id IN ({project_ids})")
else:
    clickhouse.execute(f"TRUNCATE TABLE {table}")  # backward compatible
```

**Sentry change:** Modify `reset_snuba` to track project_ids and pass them on cleanup.

**Impact:** ALL Snuba tests become safe for xdist. No more serial group. 22 shards × `-n3` = 66
effective workers. Estimated ~8-10 min wall-clock.

**Concerns:** `ALTER TABLE DELETE` is async in ClickHouse <23.3. Need to verify CI's ClickHouse
version supports synchronous lightweight deletes. Metrics tables use `org_id` not `project_id`.

### Level 3: Batch Drop Endpoint (bundle with Level 2)

`reset_snuba` makes **10 parallel HTTP calls** per test (one per dataset). Even with
`ThreadPoolExecutor(10)`, overhead is ~50-100ms/test. Over ~5,000 TRUNCATE tests: ~4-8 min total.

**Snuba change:** Single `/tests/drop_all` endpoint that handles all 10 tables in one call.
**Impact:** ~30-60s saved per shard. Bundle with Level 2 as one Snuba PR.

## The "No Cleanup" Approach: Eliminate reset_snuba Entirely

### The Idea

If every ClickHouse query is scoped by the test's unique `project_id` / `org_id`, stale data from
other tests is invisible. No cleanup needed at all. This is the conceptually cleanest solution:
tests are isolated by ID, not by wiping shared state.

With snowflake IDs per xdist worker (already implemented), each test creates objects with globally
unique IDs. If queries filter by those IDs, cross-contamination is impossible.

### Iteration 5 Revisited: Why It Failed, and What's Fixable

Iteration 5 tried skipping TRUNCATE entirely and got 50+ failures across ~15 files. Detailed
analysis of each file:

#### Category A: Already scoped, likely spurious failures (trivial to verify)

| File | Base Class | Query Pattern | Assessment |
| --- | --- | --- | --- |
| `test_organization_release_health_data.py` (~12 failures) | MetricsAPIBaseTestCase | API endpoints with org/project params | Queries go through scoped API layer. Verify all endpoints pass project params correctly. |
| `test_api.py` (~10 failures) | BaseMetricsTestCase | `run_queries()` with org/projects params | Already accepts `organization` and `projects` parameters. |
| `test_metrics_enhanced_performance.py` (~7 failures) | BaseMetricsLayerTestCase | `get_series()` with `build_metrics_query(project_ids=...)` | Already scoped by project. |
| `test_release_health.py` (2 failures) | BaseMetricsLayerTestCase | `get_series()` with project scoping | Same as above. |

These 4 files account for ~31 of the ~50 failures. They use query APIs that already accept
project/org parameters. The failures may have been caused by the query layer not enforcing filters
strictly, or by aggregation queries that bypass the project filter at the ClickHouse level.
Need deeper investigation to confirm.

#### Category B: Intentionally broad queries — fixable with assertion changes

| File | Base Class | Query Pattern | Assessment |
| --- | --- | --- | --- |
| `test_common.py` (2) | BaseMetricsLayerTestCase + SnubaTestCase | `GetActiveOrgs()` — iterates ALL active orgs | Tests assert exact counts (`total_orgs == 10`). Under xdist, other workers' orgs inflate count. Fix: change to subset assertions (`assert all(id in found for id in created_ids)`). |
| `test_tasks.py` (4) | BaseMetricsLayerTestCase + SnubaTestCase | `GetActiveOrgs()`, `sliding_window_org()` | Same pattern — scans all orgs, asserts exact counts. |
| `test_boost_low_volume_transactions.py` (2) | BaseMetricsLayerTestCase + SnubaTestCase | `FetchProjectTransactionVolumes(org_ids=...)` | Accepts org_ids but tests may assert exact totals. |
| `test_boost_low_volume_projects.py` (1-3) | BaseMetricsLayerTestCase + SnubaTestCase | Similar to above | Same pattern. |

These dynamic sampling tests use functions like `GetActiveOrgs()` that **intentionally** scan all
organizations with metrics data. The production code needs this behavior. However, the test
assertions can be changed from exact-count to subset-based:

```python
# Before (fails under xdist — other workers' orgs inflate count):
assert total_orgs == 10

# After (works under xdist — only checks our orgs are present):
assert all(org_id in found_org_ids for org_id in created_org_ids)
assert len(found_org_ids) >= len(created_org_ids)
```

The batch-size assertions (`assert num_orgs == 3` for pagination testing) are harder — they depend
on total data volume. These specific tests may need to stay in the serial group or use a scoped
variant of `GetActiveOrgs` for testing.

#### Category C: Report/summary tests — likely scoped by org

| File | Base Class | Assessment |
| --- | --- | --- |
| `test_daily_summary.py` (1-3) | SnubaTestCase | Generates reports for specific org. Likely scoped but may aggregate event counts broadly. |
| `test_weekly_reports.py` (1-3) | OutcomesSnubaTest + SnubaTestCase | Same — report generation per org. |
| `test_preview.py` (1-3) | SnubaTestCase | Rule preview queries — may aggregate group IDs from ClickHouse. |

#### Category D: Endpoint tests — API layer typically scoped

| File | Base Class | Assessment |
| --- | --- | --- |
| `test_organization_events_histogram.py` (1-3) | SnubaTestCase | API endpoint — should scope by project. |
| `test_organization_events_trends.py` (1-3) | SnubaTestCase | API endpoint — should scope by project. |
| `test_organization_root_cause_analysis.py` (1-3) | SnubaTestCase | API endpoint — should scope by project. |
| `test_organization_replay_index.py` (1-3) | ReplaysSnubaTestCase | Replay queries — should scope by project. |

### Feasibility Assessment

| Category | Files | Failures | Fix Approach | Difficulty |
| --- | --- | --- | --- | --- |
| A: Already scoped | 4 | ~31 | Verify query layer enforces filters | Needs investigation |
| B: Broad queries | 4 | ~9 | Change assertions to subset-based | Moderate (test changes only) |
| C: Report tests | 3 | ~5 | Likely scoped, verify | Trivial |
| D: Endpoint tests | 4 | ~5 | API layer scopes, verify | Trivial |

**Bottom line:** The 50+ failures are concentrated in 15 files. ~60% of failures (Category A) may
already be scoped and need verification. ~20% (Category B) need assertion changes from exact-count
to subset-based. ~20% (Categories C+D) are likely already scoped via API/report layers.

The "no cleanup" approach is viable if:
1. Category A queries are confirmed to be properly scoped at the ClickHouse level
2. Category B tests are refactored to use subset assertions
3. A small `FORCE_SERIAL` escape hatch exists for any genuinely unfixable tests

This would eliminate `reset_snuba` entirely under xdist, giving maximum parallelism with zero
cleanup overhead — the cleanest possible solution.

---

## Iteration 7: "No Cleanup" Implementation — Skip reset_snuba Entirely

### Strategy

Instead of classifying tests by whether they *trigger* `reset_snuba` (Iteration 6's approach), we
flip the model: **skip `reset_snuba` for all parallel tests** and rely on unique snowflake IDs for
ClickHouse isolation. Only a small set of files with broadly-scoped queries (`FORCE_SERIAL_FILES`)
run single-threaded with normal `reset_snuba` cleanup.

### How It Works

1. **Snowflake ID isolation**: Every `Factories.create_project()` / `create_organization()` call
   generates a globally unique snowflake ID (53-bit integer encoding timestamp + region + sequence,
   backed by Redis). Since every ClickHouse row is tagged with `project_id`, and every well-behaved
   test queries `WHERE project_id = <unique_id>`, tests naturally isolate without needing TRUNCATE.

2. **`XDIST_SKIP_SNUBA_RESET=1`**: Environment variable that makes the `reset_snuba` fixture a
   no-op (early return). Set in the parallel workflow jobs.

3. **`FORCE_SERIAL_FILES`**: Hardcoded set of ~15 test file paths whose ClickHouse queries are
   broadly scoped (don't filter by project_id). These are routed to the serial group via
   `--xdist-group=serial` and run with normal `reset_snuba` cleanup.

4. **`--xdist-group` filter**: `pytest_collection_modifyitems` hook routes tests based on
   `_force_serial()` (file in FORCE_SERIAL_FILES?) instead of `_triggers_snuba_reset()`.

### Changes Made

- `src/sentry/testutils/pytest/fixtures.py`: `reset_snuba` checks `XDIST_SKIP_SNUBA_RESET` env var
- `src/sentry/testutils/pytest/sentry.py`: Added `FORCE_SERIAL_FILES` set, `_force_serial()`,
  updated `--xdist-group` to use file-based routing
- `.github/workflows/backend-xdist-split-poc.yml`: 20 parallel shards (-n 2) + 2 serial shards

### Run 1 Results (20 parallel shards @ -n 3, 2 serial shards)

**Serial shards: 2/2 passed** — The FORCE_SERIAL_FILES tests work correctly with normal cleanup.

**Parallel shards: 12/20 passed, 5 failed, 8 still running (with worker crashes)**

#### Test Failures (stale ClickHouse data — expected)

| Failing Test | Shards | Root Cause |
| --- | --- | --- |
| `tests/snuba/rules/conditions/test_event_frequency.py` | 3 shards | Event frequency queries see extra events from other workers. `assert 2 == 1`, `assert False is True`. Broadly scoped time-window queries. |
| `tests/snuba/api/endpoints/test_organization_events_trends.py` | 2 shards | Transaction count queries: `assert 0 == 1` (count_range_1). Trends endpoint aggregates without tight project filter. |
| `tests/snuba/api/endpoints/test_organization_events_histogram.py` | 1 shard | Was in FORCE_SERIAL_FILES but under **wrong path** (`tests/sentry/...` vs `tests/snuba/...`). Path mismatch meant it wasn't routed to serial. |
| `tests/sentry/release_health/release_monitor/test_metrics.py` | 1 shard | Metrics counts off: `assert 14 == 15`, `assert 0.03 in [0.02, 0]`. Session/release health metrics see extra data. |
| `tests/relay_integration/test_integration.py` | 2 shards | `assert None is not None` — event not found after store. Likely a relay→Snuba pipeline timing issue under load. |

#### Worker Crashes (`[gw2] node down: Not properly terminated`)

Multiple shards experienced xdist worker crashes with `node down: Not properly terminated`. The
associated `TimeoutError: timed out` in the Django test server is a **symptom**, not the cause:

1. xdist worker dies (likely OOM)
2. Its orphaned Django test server socket times out waiting for a request
3. xdist detects the dead worker and spawns a replacement

**Probable cause: OOM on GitHub Actions runners (~7GB RAM)**. With `-n 3`, each shard runs:
- 3 full Sentry Django processes (each is very heavy)
- Postgres, Redis, Kafka, ClickHouse, Snuba, Symbolicator (Docker containers)
- Without TRUNCATE, ClickHouse tables grow unbounded — data accumulates across all tests

**Fix: Drop to `-n 2`** to reduce memory pressure. Two Django workers + devservices should fit
within 7GB more comfortably.

#### Path Mismatches in FORCE_SERIAL_FILES

The original list had paths under `tests/sentry/api/endpoints/` but the actual failing tests are
under `tests/snuba/api/endpoints/`. Both directories contain test files with the same names:
- `tests/sentry/api/endpoints/test_organization_events_histogram.py` (in list, may not exist)
- `tests/snuba/api/endpoints/test_organization_events_histogram.py` (actual failing file)

Same for `test_organization_events_trends.py`.

#### Files to Add to FORCE_SERIAL_FILES

Based on Run 1 failures:
- `tests/snuba/rules/conditions/test_event_frequency.py` — broad time-window event frequency queries
- `tests/snuba/api/endpoints/test_organization_events_trends.py` — trends aggregation
- `tests/snuba/api/endpoints/test_organization_events_histogram.py` — histogram aggregation
- `tests/sentry/release_health/release_monitor/test_metrics.py` — release health metrics counts
- `tests/relay_integration/test_integration.py` — relay integration event pipeline

#### Key Insight: Accidental Passes

A green test in this run **does not prove correctness**. Tests can pass accidentally because:
- Their shard happened to have no overlapping writes from other workers
- Stale data coincidentally satisfied assertions (e.g., `count >= 1` always passes with extra data)
- The broad query returned correct results by luck of timing

This means the FORCE_SERIAL_FILES list will likely need multiple iterations to stabilize. Strategy:
run the suite repeatedly, collect new failures each time, add files to the list, repeat until
stable. Tests that fail intermittently across runs are the most important to catch.

---

## Iteration 8: Tiered xdist Hybrid — Combining Tiered CI with "No Cleanup"

### Motivation

Iteration 7 (20 parallel shards @ `-n 3`) hit OOM on GitHub Actions runners (~7GB RAM). The memory
budget is tight:
- Docker containers (ClickHouse, Kafka, Zookeeper, Snuba, Postgres, Redis, Symbolicator): ~2-3GB
- 3 xdist workers, each loading the full Sentry Django app: ~1.5-3GB
- Total: ~5-7.5GB, right at the edge

**Key insight:** ~71% of tests don't need Snuba/ClickHouse at all. For those tests, we can skip
the Snuba stack entirely (`mode: migrations` instead of `mode: backend-ci`), freeing ~1.5-2GB RAM.
With that headroom, these shards can safely run `-n 3`. The remaining ~29% that need Snuba run
`-n 2` to stay within memory limits.

This combines the **Tiered CI** approach (Iteration 4) with the **"No Cleanup" xdist** approach
(Iteration 7) for the best of both worlds.

### Architecture

Three job groups:

1. **Tier 1 (6 shards, `-n 3`)**: Postgres + Redis only. `mode: migrations`. No ClickHouse/Kafka/
   Snuba containers. Lighter memory footprint enables `-n 3`. Setup is ~4-5 min faster. Uses
   `SELECTED_TESTS_FILE` from runtime classification JSON. ~71% of tests.

2. **Tier 2 Parallel (14 shards, `-n 2`)**: Full `mode: backend-ci` stack. `XDIST_SKIP_SNUBA_RESET=1`
   to skip TRUNCATE TABLE. `--xdist-group=parallel` to exclude `FORCE_SERIAL_FILES`. ~28% of tests.

3. **Tier 2 Serial (2 shards, single-threaded)**: Full `mode: backend-ci` stack. Normal `reset_snuba`
   cleanup. `--xdist-group=serial` selects only `FORCE_SERIAL_FILES`. ~1% of tests.

### How the Pieces Compose

The tier split and xdist-group split are orthogonal:

- **`SELECTED_TESTS_FILE`**: Filters test files at collection time based on the runtime classification
  JSON (from `classify-services` workflow → `split-tests-by-tier.py`). Tier 1 gets `tier1-tests.txt`,
  Tier 2 gets `tier2-tests.txt`.
- **`--xdist-group`**: Further filters within Tier 2. `parallel` excludes `FORCE_SERIAL_FILES`,
  `serial` includes only `FORCE_SERIAL_FILES`. Tier 1 doesn't use this (no Snuba = no serial concern).
- **`XDIST_SKIP_SNUBA_RESET`**: Only set on Tier 2 parallel shards. Makes `reset_snuba` fixture a
  no-op.

### Why Runtime Classification (not `_needs_snuba()`)

The original tiered CI used a runtime classification JSON generated by the `classify-services`
workflow, which monitors actual socket connections during test execution. This is more accurate than
the static `_needs_snuba()` function because:
- `_needs_snuba()` relies on pytest markers and class inheritance — it can miss implicit dependencies
- Runtime classification catches tests that connect to services via indirect code paths
- The classification has already been validated across multiple CI runs

### Shard Math (optimized after Run 1 timing data)

| Group | Tests | Shards | xdist | Effective Workers | Mode | Est. Wall Clock |
| --- | --- | --- | --- | --- | --- | --- |
| Tier 1 | ~71% | 4 | `-n 3` | 12 | migrations | ~11.8m |
| Tier 2 Parallel | ~28% | 16 | `-n 2` | 32 | backend-ci | ~12.1m |
| Tier 2 Serial | ~1% | 2 | none | 2 | backend-ci | ~11.7m |
| **Total** | **100%** | **22** | | **46** | | **~12.1m** |

Total of 22 shards (same as current backend CI) but with 46 effective workers instead of 22.

### Hybrid Run 1 Results (6 tier1 / 14 tier2-parallel / 2 tier2-serial)

**Split-tiers job: passed. Tier 1: 6/6 passed. Tier 2 serial: 2/2 passed.**

**Tier 2 parallel: 6/14 passed, 8 failed, 1 crashed (OOM).**

This run used the old `FORCE_SERIAL_FILES` (21 entries) so some failures are repeats from Run 2
on `mchen/xdist-two-group`.

#### Tier 1 Timing (all passed)

| Shard | Duration |
| --- | --- |
| tier1 (0) | 8.8m |
| tier1 (1) | 8.3m |
| tier1 (2) | 8.6m |
| tier1 (3) | 10.3m |
| tier1 (4) | 8.6m |
| tier1 (5) | 9.0m |
| **Average** | **8.9m** |

Tier 1 is over-sharded at 6 — finishes 4m before tier2-parallel. Redistributing 2 shards.

#### Tier 2 Parallel Timing

Average: 12.8m (range 11.7-14.1m). This is the bottleneck. Giving it 2 more shards.

#### Optimal Shard Rebalancing

Analysis based on observed test execution times (excluding setup overhead):
- Tier 1 setup: ~3m, Tier 2 setup: ~7m
- Tier 1 total test work: ~35.4 min-shards, Tier 2 parallel: ~81.2 min-shards

Optimal split at 4 tier1 / 16 tier2-parallel / 2 tier2-serial equalizes wall clock at ~12m across
all groups. Previous split (6/14/2) had tier1 finishing at 8.9m (wasted 4m of capacity).

#### New Failures (not in FORCE_SERIAL_FILES)

| File | Shards | Root Cause |
| --- | --- | --- |
| `tests/relay_integration/lang/javascript/test_plugin.py` | 4 | `assert None is not None` — relay store returns None |
| `tests/relay_integration/test_message_filters.py` | 1 | Same relay pipeline issue |
| `tests/relay_integration/lang/java/test_plugin.py` | 1 | Same pattern — new relay file |
| `tests/relay_integration/lang/javascript/test_example.py` | 1 | Same pattern — new relay file |
| `tests/sentry/api/endpoints/test_organization_sampling_project_span_counts.py` | 1 | `assert 347.0 == 21.0` — stale data |
| `tests/sentry/release_health/test_tasks.py` | 1 | FK constraint IntegrityError |
| `tests/sentry/issues/test_suspect_flags.py` | 1 | Wrong flag scores |

#### Decision: Force entire `tests/relay_integration/` to serial

5 different `relay_integration/` files failed across Runs 1-3. All have the same pattern:
`RelayStoreHelper` stores events through Relay→Snuba, then reads back from ClickHouse. Without
TRUNCATE, read-back frequently fails. Rather than adding files one by one, we now use
`FORCE_SERIAL_DIRS` to force the entire directory to serial.

#### Updated FORCE_SERIAL

- `FORCE_SERIAL_FILES`: 24 entries (added span counts, release health tasks, suspect flags)
- `FORCE_SERIAL_DIRS`: `tests/relay_integration/` (entire directory)
- `_force_serial()` now checks both file set and directory prefix

### Iteration 9: Test Bugs Uncovered by xdist

Our xdist parallelization work uncovered pre-existing test bugs that were silently passing
in single-threaded mode by relying on implicit global state.

#### Bug: `test_sdk.py::CheckScopeTransactionTest::test_custom_transaction_name`

**Symptom**: Under xdist, the test fails with:
```
AssertionError: assert {'request_transaction': '/dogs/{name}/',
                        'scope_transaction': 'github.webhook.issue_comment'} is None
```

**Root cause**: The test patched the wrong Sentry SDK scope object. The production code
`check_current_scope_transaction()` calls `sentry_sdk.get_current_scope()` (the *current*
scope), but the test used `patch_isolation_scope()` which patches `Scope.get_isolation_scope`
(the *isolation* scope) — a completely different object in Sentry SDK v2.

In single-threaded mode, the real current scope happens to be empty (`_transaction = None`),
so the function short-circuits at `if scope._transaction is not None` and returns `None`.
The test passes by accident.

Under xdist, another worker's test (e.g. a GitHub webhook handler) sets `_transaction` on
the real shared current scope. Now the function sees a non-None transaction, the check
doesn't short-circuit, and the assertion fails.

The other two tests in the same class (`test_scope_has_correct_transaction`,
`test_scope_has_wrong_transaction`) correctly patch `sentry_sdk.get_current_scope`. This
one simply used the wrong mock target.

**Fix**: Changed the test to patch `sentry_sdk.get_current_scope` (matching the other two
tests in the class) instead of `Scope.get_isolation_scope`. One-line fix, no behavioral
change to what's being tested.

**Takeaway**: xdist doesn't just speed up tests — it exposes hidden shared-state assumptions.
Tests that "work" single-threaded may be relying on a clean global environment rather than
properly isolating their inputs. This is a valuable side-effect of parallelization.

### Iteration 10: Relay Test Performance — Container Restart Per Test

#### Problem

Timing analysis of the hybrid CI run showed tier2-serial as the bottleneck (14m wall clock).
The slowest tests are all `relay_integration/` tests at 12-18s each. With ~100 relay tests
forced to serial, they dominate the serial tier's runtime.

#### Root Cause: `relay_server` Fixture is Function-Scoped

The `relay_server` fixture (`src/sentry/testutils/pytest/relay.py:130`) is `scope="function"`,
meaning **every single relay test** pays the full Docker container lifecycle cost:

1. Stop + kill + remove existing container (`_remove_container_if_exists`)
2. Start a new Relay Docker container (`docker_client.containers.run`)
3. Wait for health check (exponential backoff up to ~25s: `0.1 * 2^i` for i=0..7)
4. Run the actual test (send event → Kafka pipeline → poll ClickHouse)
5. Leave container running (cleanup deferred to module-scoped `relay_server_setup`)

Steps 1-3 account for ~10s of the 12-18s per test.

The `relay_server_setup` fixture (module-scoped) only generates config files and reserves a
port. The actual container start/stop happens in `relay_server` (function-scoped).

#### Analysis: Is the Function Scope Necessary?

Relay is configured in `managed` mode and caches project configs (fetched from Sentry's API
or Redis). The concern would be stale cached configs leaking between tests. However:

1. **`TransactionTestCase` creates fresh projects each test.** Each test gets a new
   `self.project` with a unique `project_id`. Relay has never seen this project ID before,
   so it fetches a fresh config — no stale cache issue.

2. **Events are keyed by project ID.** `post_and_retrieve_event` sends to
   `relay_store_url(self.project.id)` and queries `eventstore.get_event_by_id(self.project.id,
   event_id)`. Different tests use different project IDs — no cross-test contamination.

3. **Filter tests modify `ProjectOption` on new projects.** `FilterTests._set_filter_state`
   writes to `self.project` (fresh each test). Relay fetches config for the new project ID
   on first request — it doesn't carry over the previous test's filter settings.

4. **Trusted relay tests call `invalidate_project_config`** explicitly. The config is
   pushed to Redis and Relay picks it up for the specific project.

5. **Rate limiters are per-project-key**, not global. A new project = new rate limit state.

**Conclusion:** The function-scoped container restart appears to be defensive programming,
not a functional requirement. The per-test project isolation from `TransactionTestCase`
already prevents state leaks. Relay has no global mutable state that would carry between
tests using different project IDs.

#### Experiment: Change to Class Scope — FAILED

Changed `relay_server` to `scope="class"` to start the container once per class. Result:
massive failures across all relay tests with `assert None is not None` and
`Project for ingested event does not exist: 1`.

**Root cause:** Relay caches project configs **in memory** (not just Redis). When
`TransactionTestCase` flushes the database between tests, the project from the previous
test is deleted. But Relay still holds the old project config in its in-memory cache.
When the next test sends an event, Relay forwards it using the stale config, and the
ingest consumer fails because the project no longer exists in Postgres.

**The function scope IS necessary.** Restarting the container is the only way to clear
Relay's in-memory project config cache. A lighter alternative would be to add a Relay
admin API endpoint to flush its config cache, but that doesn't exist today.

**Reverted** back to `scope="function"`. The relay tests remain at 12-18s each. The serial
tier bottleneck stands — adding more serial shards is the pragmatic fix.
