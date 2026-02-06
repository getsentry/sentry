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
- **Redis (1,478 tests)** was higher than expected. The default `server.py` uses `DummyCache`, but CI settings may override this to use Redis-backed caching, meaning more tests hit Redis at runtime than static analysis would suggest. This validates the runtime approach for Redis.
- **Kafka (254 tests)** detected via static `requires_kafka` markers. Higher than the 20 files we estimated because each file contains multiple tests.

## Validation

The classification can be validated empirically: run "postgres-only" tier tests with only Postgres running. Any test that fails reveals a misclassification. The `requires_*` fixtures provide built-in fail-fast guards for their respective services.

## Expected Impact

If classification is accurate, ~68% of backend tests can run with just Postgres (setup time: ~30s) instead of the full Snuba stack (setup time: 4-5min). An additional ~26% may need no services at all. Combined with intelligent sharding, this could significantly reduce CI wall-clock time.
