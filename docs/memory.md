# Tiered xdist CI Optimization — Reference Document

Source branch: `mchen/tiered-xdist-clean` (experiment history + final state).
Clean branch: `mchen/tiered-xdist-v2` (this work, incremental application).

---

## 1. Architecture Overview

Split Sentry's backend CI tests into **two tiers** with **pytest-xdist** parallelism inside each shard:

- **Tier 1** (5 shards, `-n 4` workers): ~71% of tests. Postgres + Redis only (`migrations` mode). No Snuba/Kafka/ClickHouse.
- **Tier 2** (17 shards, `-n 3` workers): ~29% of tests. Full stack with per-worker service isolation + overlapped startup (H1).

Each xdist worker within a shard gets isolated instances of every shared mutable resource (Snuba, Redis, Kafka topics, Relay containers, snowflake IDs).

### Key metrics achieved

| Metric | Baseline (22 shards, no tiers) | Best achieved |
|--------|-------------------------------|---------------|
| Wall clock | ~15m | ~10m |
| Runner-minutes | ~268m | ~201-208m |

---

## 2. Incremental Application Plan

### Phase 1: Bug Fixes (independent, safe on master)

**1a. Exclude `.venv/` from pyc cleanup**
- File: `.github/actions/setup-sentry/action.yml`
- The `find . -type d -name __pycache__ -exec rm -rf {} +` also nukes `.venv/__pycache__/`, forcing recompilation of all venv packages every CI run.
- Fix: Add `-not -path './.venv/*'` to both find commands.

**1b. Add `django_db` marker to `test_buffer.py`**
- File: `tests/sentry/spans/test_buffer.py`
- `flush_segments()` → `_load_segment_data()` calls `Project.objects.get_from_cache()` when `dropped > 0`, which needs DB access. Without `django_db`, this causes "Database access not allowed" under `--dist=load` (and flaky reruns even under `loadfile`).
- Fix: Add `pytestmark = [pytest.mark.django_db]` after imports.
- **NOTE**: The branch diff also contains unrelated changes to `_segment_id()` and `DEFAULT_OPTIONS` from master drift. Only apply the `pytestmark` line.

**1c. Fix flaky dashboard widget ordering**
- File: `tests/sentry/dashboards/endpoints/test_organization_dashboard_details.py`
- `widget_3` and `widget_4` in `OrganizationDashboardDetailsPutTest.setUp()` lack `order=`. `DashboardWidget.order` is `BoundedPositiveIntegerField(null=True)`. `ORDER BY order` with all-NULL values = undefined ordering = flaky assertions.
- Master already has `order=0` on `widget_1` and `order=1` on `widget_2`. Only `widget_3` (needs `order=2`) and `widget_4` (needs `order=3`) are missing.
- Fix: Add `order=2` and `order=3` respectively.
- **NOTE**: Branch diff includes lots of unrelated test changes from master drift. Only apply the 4 `order=` additions.

**1d. Swallow Redis `ConnectionError` in teardown**
- File: `src/sentry/testutils/pytest/sentry.py`
- `pytest_runtest_teardown` calls `client.flushdb()`. If Redis is momentarily unavailable (e.g., during xdist shutdown), this crashes teardown.
- Fix: Wrap in `try/except RedisConnectionError: pass`.

### Phase 2: Lazy Imports (safe refactoring)

**2a. Lazy selenium imports**
- File: `src/sentry/testutils/pytest/selenium.py`
- Move `from selenium import webdriver` and all selenium submodule imports from module-level into the method bodies that use them. selenium is 23MB and never used on CI shards (all pass `--ignore tests/acceptance`).
- The `start_chrome` function needs restructuring: the `@TimedRetryPolicy.wrap` decorator references `WebDriverException` which must be imported first. Solution: move the import inside and nest the decorated function.

**2b. Lazy kafka/relay imports**
- File: `src/sentry/testutils/pytest/kafka.py` — move `from confluent_kafka import Consumer, Producer` and `AdminClient` inside fixture bodies.
- File: `src/sentry/testutils/pytest/relay.py` — move `import ephemeral_port_reserve`, `import requests`, and `from sentry.runner.commands.devservices import get_docker_client` inside fixture/function bodies.
- Python caches in `sys.modules` so first call pays import cost, subsequent calls are O(1).

### Phase 3: xdist Isolation Infrastructure (no-ops without env vars)

**3a. Core xdist helpers in `sentry.py`**

Add to `src/sentry/testutils/pytest/sentry.py`:

```python
def _get_xdist_worker_num() -> int | None:
    worker_id = os.environ.get("PYTEST_XDIST_WORKER")
    if worker_id:
        return int(worker_id.replace("gw", ""))
    return None

def _get_xdist_redis_db() -> int:
    worker_num = _get_xdist_worker_num()
    if worker_num is not None:
        return TEST_REDIS_DB + worker_num
    return TEST_REDIS_DB

def _get_xdist_kafka_topic(base_name: str) -> str:
    worker_id = os.environ.get("PYTEST_XDIST_WORKER")
    if worker_id:
        return f"{base_name}-{worker_id}"
    return base_name
```

Wire `_get_xdist_redis_db()` into `settings.SENTRY_OPTIONS["redis.clusters"]` (replaces hardcoded `TEST_REDIS_DB`).

**3b. Per-worker Snuba routing**

The env var `SNUBA` must be set **before** Django settings load because `SENTRY_SNUBA = os.environ.get("SNUBA", ...)` in `server.py` reads it at import time.

The branch does this with a module-level block at the top of `sentry.py`:
```python
_xdist_worker = os.environ.get("PYTEST_XDIST_WORKER")
if _xdist_worker and os.environ.get("XDIST_PER_WORKER_SNUBA"):
    _worker_num = int(_xdist_worker.replace("gw", ""))
    os.environ["SNUBA"] = f"http://127.0.0.1:{1230 + _worker_num}"
```

This is placed between `import os` and `import collections` — intentionally before any Django imports. **Cannot be moved to `pytest_configure`** because the `sentry.conf.server` import (triggered by `DJANGO_SETTINGS_MODULE`) happens before `pytest_configure` runs in this plugin.

Belt-and-suspenders: session fixture `_xdist_per_worker_snuba` also patches `_snuba_pool` singleton in case of unexpected import ordering.

**3c. Deterministic region name + per-worker snowflake IDs**

In `_configure_test_env_regions()`:
- Seed `random.Random` with `PYTEST_XDIST_TESTRUNUID` so all workers generate the same region name (xdist requires identical test collection order).
- Set `region_snowflake_id = worker_num + 1` (0 is the default for non-xdist; workers use 1, 2, 3...). The snowflake ID field is 12 bits (0–4095), plenty of room.

**3d. Per-worker Kafka topic isolation**

Files: `src/sentry/testutils/pytest/kafka.py`, `src/sentry/testutils/pytest/template/config.yml`

- `kafka.py`: Replace hardcoded `"ingest-events"`, `"outcomes"`, `"test-consumer"` with `_get_xdist_kafka_topic(...)`.
- `template/config.yml`: Replace hardcoded topic names with `${KAFKA_TOPIC_EVENTS}` / `${KAFKA_TOPIC_OUTCOMES}` template variables.
- `relay.py` `relay_server_setup`: Pass the template vars `KAFKA_TOPIC_EVENTS` and `KAFKA_TOPIC_OUTCOMES`.

**Important**: `scope_consumers` dict keys become dynamic (`"ingest-events-gw0"` etc.) but this is correct because both the dict creation and lookup use `_get_xdist_kafka_topic()` in the same worker process.

**3e. Per-worker Relay container isolation**

File: `src/sentry/testutils/pytest/relay.py`

Changes:
- `_relay_server_container_name()`: append `_{worker_id}` under xdist.
- `relay_server_setup`: per-worker port offset (`33331 + worker_num * 100`).
- New `_relay_container` fixture (class-scoped): starts Docker container once per class instead of per test. Saves ~650s of lifecycle overhead.
- New `_ensure_relay_in_db()`: re-inserts Relay model row before each test. `TransactionTestCase` flushes DB between tests, deleting the Relay row. Values must match `template/credentials.json`:
  - `_RELAY_ID = "88888888-4444-4444-8444-cccccccccccc"`
  - `_RELAY_PUBLIC_KEY = "SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"`
- `relay_server` (function-scoped): now depends on `_relay_container`, calls `_ensure_relay_in_db()`.

**3f. `_requires_snuba` polling + per-worker port**

File: `src/sentry/testutils/skips.py`

- Read port from `SNUBA` env var (per-worker port 1230+N).
- Add `_wait_for_service()` polling loop for H1 overlapped startup (controlled by `SNUBA_WAIT_TIMEOUT`).

**3g. Disable rerunfailures socket crash recovery**

File: `tests/conftest.py`

```python
import pytest_rerunfailures
pytest_rerunfailures.HAS_PYTEST_HANDLECRASHITEM = False
```

`pytest-rerunfailures` 15.0+ auto-detects xdist and creates a TCP socket server/client for crash recovery. The socket protocol deadlocks during heavy xdist startup. Disabling forces the in-memory `StatusDB` fallback. Normal `--reruns` still works.

**3h. Snowflake test fix**

File: `tests/sentry/utils/test_snowflake.py`

Wrap `test_generate_correct_ids` and `test_generate_correct_ids_with_region_sequence` in `override_regions` with explicit `Region("test-region", 0, ...)` so expected snowflake values are deterministic regardless of xdist worker's `region_snowflake_id`.

### Phase 4: Tooling

**4a. Service classifier plugin**

New file: `src/sentry/testutils/pytest/service_classifier.py`
Register in: `src/sentry/testutils/pytest/__init__.py`

Hybrid static + runtime test classification:
- Static: checks fixtures (`_requires_snuba`, `_requires_kafka`, etc.), class inheritance for Postgres.
- Runtime: monkey-patches `socket.send`/`socket.sendall`, checks `getpeername()` port against `SERVICE_PORTS` dict (snuba:1218, symbolicator:3021, bigtable:8086, objectstore:8888).
- Opt-in via `--classify-services` flag. Zero overhead when disabled.
- Output: `test-service-classification.json`

Also includes `--classify-databases` / `--narrow-databases` for database narrowing (found to be a dead end — 98.9% of classes touch all 3 DBs due to base fixtures creating Organization/Project/Team which route to control/secondary).

**4b. Split-tests-by-tier script**

New file: `.github/workflows/scripts/split-tests-by-tier.py`

Reads classification JSON, splits tests into tier1/tier2 based on service dependencies.
- `FORCE_TIER2_FILES`: hardcoded overrides for tests the classifier misses.
- `TIER2_SERVICES`: `{"snuba", "kafka", "symbolicator", "objectstore", "bigtable"}`.
- Granularity support: file/class/test level.
- Contains LPT sharding code (`--shards N`) that is currently unused (experiments showed LPT doesn't help — see dead ends below). Consider removing.

**4c. Classify-services workflow**

New file: `.github/workflows/classify-services.yml`

`workflow_dispatch` only. Runs the classifier across 22 shards, merges per-shard reports into one artifact.

### Phase 5: Collection Optimization (G1) + H1 Overlapped Startup Support

**`pytest_ignore_collect` hook** in `sentry.py`:

When `SELECTED_TESTS_FILE` is set, prevents pytest from importing files not in the tier's list. Runs before module import, avoiding ~1m45s full-collection overhead per shard.

Guards:
- Directories pass through (pytest needs to descend).
- Non-`.py` files pass through.
- `conftest.py` files always pass through (fixtures needed by children).
- Only filters files under `tests/`.

**`_wait_for_services` session fixture** in `sentry.py`:

Blocks until `/tmp/services-ready` sentinel file exists (created by background service-startup script). Needed because G1 makes collection finish ~50s faster, potentially before services are ready.

**`_requires_snuba` polling** in `skips.py`: Add `_wait_for_service()` polling controlled by `SNUBA_WAIT_TIMEOUT` env var. With H1 overlapped startup, Snuba may not be up when pytest starts. The polling waits instead of failing immediately.

**Two-layer filtering note**: Both G1 (`pytest_ignore_collect`) and `pytest_collection_modifyitems` filter by `SELECTED_TESTS_FILE`. G1 prevents import; `modifyitems` deselects after import. G1 is the performance win; `modifyitems` handles class/test granularity filtering and shard assignment.

### Phase 6: Performance Optimizations

**Relay container lifecycle**: Broaden `relay_server_setup` and `_relay_container` from function/module scope to session scope. `live_server` is already session-scoped, so this is safe. One Docker container per worker session instead of per test. Only ~6 relay test classes exist, saving ~50-60s. Add `_relay_container` session-scoped fixture, make `relay_server` a thin wrapper calling `_ensure_relay_in_db()` + `adjust_settings_for_relay_tests()`.

### Phase 7: Tiered Workflow

**`backend-xdist-split-poc.yml`**: The full CI workflow.

Jobs: `split-tiers` → `tier1` + `tier2` in parallel.

**Tier 1 config:**
- `mode: migrations`, `-n 4 --dist=load`
- Kafka + redis-cluster + zookeeper as GitHub Actions `services:` containers (Kafka can't be started alone via devservices — bundled with Snuba).
- Postgres via Unix socket for lower latency.
- `TEST_GROUP_STRATEGY: roundrobin`, `PYTHONHASHSEED: '0'`.

**Tier 2 config:**
- `mode: backend-ci`, `-n 3 --dist=loadfile`
- H1 overlapped startup: background subshell runs `sentry init` → `devservices up` → per-worker Snuba bootstrap while pytest starts immediately.
- Per-worker Snuba containers on ports 1230+N with separate ClickHouse databases (`default_gw0/1/2`).
- Postgres via Unix socket (container restarted with socket volume mount).
- `XDIST_PER_WORKER_SNUBA: '1'`, `SNUBA_WAIT_TIMEOUT: '180'`.
- `SERVICES_READY_FILE: /tmp/services-ready` for G1 gate.
- `DJANGO_LIVE_TEST_SERVER_ADDRESS: '172.17.0.1'` for relay tests (Docker bridge gateway).

**Postgres Unix socket implementation:**
```bash
mkdir -p /tmp/pg-sock
PG_IMAGE=$(docker inspect postgres-postgres-1 --format '{{.Config.Image}}')
docker stop postgres-postgres-1 && docker rm postgres-postgres-1
docker run -d --name postgres-postgres-1 \
  --network devservices --label orchestrator=devservices \
  -p 127.0.0.1:5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  -v /tmp/pg-sock:/var/run/postgresql \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=sentry \
  "$PG_IMAGE" postgres \
    -c wal_level=logical -c max_replication_slots=1 -c max_wal_senders=1
until [ -S "/tmp/pg-sock/.s.PGSQL.5432" ]; do sleep 0.5; done
```

Django `HOST` override in `sentry.py` `pytest_configure`:
```python
if _pg_socket := os.environ.get("SENTRY_DB_SOCKET"):
    settings.DATABASES["default"]["HOST"] = _pg_socket
    settings.DATABASES["default"]["PORT"] = ""
```

Must be set before `configure_split_db()` so control/secondary inherit it.

**devservices/config.yml**: Added `backend-ci-light: [snuba, postgres, redis, redis-cluster]` mode (currently unused — 3-tier was reverted to 2-tier).

---

## 3. Code Review Findings — Issues to Fix During Rewrite

1. **Module-level side effect in `sentry.py`**: The `os.environ["SNUBA"]` mutation between imports is fragile but necessary (must happen before Django settings load). Document clearly why.

2. **Worker-id parsing duplication**: `PYTEST_XDIST_WORKER` is parsed in 5+ places. Consolidate into a single `_get_xdist_worker_num()` helper.

3. **`_wait_for_services` uses `time.time()`**: Should use `time.monotonic()` for timeout calculations (immune to clock adjustments). Same issue in `skips.py` — `_wait_for_service()` correctly uses `time.monotonic()` already.

4. **`_relay_container` lacks `try/finally` on teardown**: If container never becomes healthy, the post-yield cleanup won't run and Docker containers leak.

5. **`start_chrome` restructuring in selenium.py**: The nested function approach works but is awkward. Consider keeping the decorator pattern and moving just the import.

6. **`pytest_rerunfailures` monkey-patch is fragile**: `HAS_PYTEST_HANDLECRASHITEM` is an internal attribute. Add a `hasattr` guard or version check.

7. **Dashboard diff has master drift**: Only the 4 `order=N` lines are the real fix; the rest (tuple formatting, new tests) are from master evolution.

8. **`test_buffer.py` diff has master drift**: Only the `pytestmark` line is the fix; `_segment_id` and `DEFAULT_OPTIONS` changes are from buffer API evolution.

9. **LPT sharding code in `split-tests-by-tier.py` is unused**: The `--shards` / `--output-dir` / `lpt_shard()` code is dead. Decide: keep for future or remove.

10. **`scope_consumers` bare `except:` on master**: Branch fixes this to `except Exception:` — a good cleanup to include.

---

## 4. Experiment Results Summary (for context, not for code)

### What worked

| Optimization | Impact | Mechanism |
|---|---|---|
| pytest-xdist (Step 2) | 3x intra-shard parallelism | Per-worker isolation of all shared state |
| Overlapped startup H1 (Step 3) | −1.5m wall clock | Background devservices while pytest collects |
| Two-tier split (Step 4) | −13% runner-min (268→216m) | T1 skips Snuba stack entirely |
| G1 `pytest_ignore_collect` | −50s/shard, −20m runner-min | Skip importing irrelevant test files |
| Postgres Unix socket | −36s T1 max, −7m runner-min | Unix socket vs TCP loopback for Postgres |
| Lazy plugin imports | ~17s savings | Defer selenium/kafka/docker imports |
| Venv pyc fix | Preserves cached bytecode | Stop deleting `.venv/__pycache__/` |
| T1 n=4 workers | −21s T1 | T1 has CPU headroom (no Snuba) |

### What didn't work

| Experiment | Result | Why |
|---|---|---|
| Scope sharding | 19.5m (vs 11.9m) | Mega-classes create hotspots |
| Three-tier split | No runner-min savings | Heavy images add only ~5-10s; T3 shard ate savings |
| LPT by test count | +61% wall clock | Test count is terrible proxy for duration |
| Flat LPT by duration | 289s spread despite perfect totals | Ignores intra-shard parallelism (`max(worker)` ≠ `sum(worker)`) |
| Worker-simulated LPT + swap | +2.5m | Indivisible mega-scopes + 3.5x slower collection |
| ClickHouse max_threads=2 | −9s T2 alone, but +44s combined with pg-socket | Slows Snuba queries; counterproductive with pg-socket |
| Postgres synchronous_commit=off | No benefit (2 runs) | WAL sync isn't the bottleneck |
| T1 n=5 workers | No benefit | 4 CPUs saturated at n=4 |
| Snuba Unix socket | Abandoned | Snuba uses granian now (ignores uWSGI socket); single-RTT HTTP makes transport overhead negligible |
| Database narrowing | Dead end | 98.9% of classes touch all 3 DBs |
| `--dist=load` on T1 | +56s fixture churn | Interleaving tests from different files causes repeated fixture setup/teardown |

### Key architectural insights

- **CPU is the bottleneck on T2** (4-CPU runner, run queue 4.5-5.6). Memory is fine (~5.3GB of 16GB).
- **`databases = "__all__"` on every TestCase** causes 3x SAVEPOINT round-trips (region/control/secondary). Can't fix: 98.9% of classes genuinely touch all 3 DBs.
- **54 files use TransactionTestCase** (expensive full-DB flush vs cheap SAVEPOINT rollback). Audit could help.
- **Hash-based roundrobin sharding outperforms algorithmic LPT** because with 17+ shards, law of large numbers gives good-enough balance, and indivisible mega-scopes create unavoidable hotspots.
- **`--dist=loadfile` is best for T2** (fixture reuse within files). **`--dist=load` is best for T1** (after fixing `test_buffer.py`).

---

## 5. File-Level Change Map

Files modified on the experiment branch (excluding docs/master-drift):

| File | Phase | What |
|---|---|---|
| `.github/actions/setup-sentry/action.yml` | 1a | Exclude .venv from pyc cleanup |
| `tests/sentry/spans/test_buffer.py` | 1b | Add `django_db` marker |
| `tests/sentry/dashboards/endpoints/test_organization_dashboard_details.py` | 1c | Add `order=` to widget fixtures |
| `src/sentry/testutils/pytest/sentry.py` | 1d, 3a-c, 5a | Core: helpers, isolation, G1, pg-socket, Redis teardown fix |
| `src/sentry/testutils/pytest/selenium.py` | 2a | Lazy selenium imports |
| `src/sentry/testutils/pytest/kafka.py` | 2b, 3d | Lazy kafka imports + per-worker topics |
| `src/sentry/testutils/pytest/relay.py` | 2b, 3e | Lazy relay imports + per-worker containers |
| `src/sentry/testutils/pytest/template/config.yml` | 3d | Kafka topic template variables |
| `src/sentry/testutils/skips.py` | 3f | Snuba polling + per-worker port |
| `tests/conftest.py` | 3g | Disable rerunfailures crash recovery |
| `tests/sentry/utils/test_snowflake.py` | 3h | Fix snowflake tests for xdist |
| `src/sentry/testutils/pytest/service_classifier.py` | 4a | New: service classifier plugin |
| `src/sentry/testutils/pytest/__init__.py` | 4a | Register classifier plugin |
| `.github/workflows/scripts/split-tests-by-tier.py` | 4b | New: tier splitter script |
| `.github/workflows/classify-services.yml` | 4c | New: classifier workflow |
| `.github/workflows/backend-xdist-split-poc.yml` | 6a | New: tiered CI workflow |
| `devservices/config.yml` | 6b | Add backend-ci-light mode |
