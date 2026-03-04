# Tiered xdist v2 — Change Log

## 1. Bug Fixes and Unused Plugin Cleanup

### 1a. Exclude `.venv/` from pyc cleanup

**File:** `.github/actions/setup-sentry/action.yml` (lines 93-94)

**What:** Added `-not -path './.venv/*'` to the two `find` commands that delete `__pycache__` dirs and `.pyc` files.

**Why:** The "Clear Python cache" step runs `find` from the repo root, which includes `.venv/`. The previous step (`action-setup-venv`) just restored the venv from cache — including compiled bytecode. Deleting it forces Python to recompile every installed package on first import during every CI run, making the venv cache less effective than intended.

### 1b. Add `django_db` marker to `test_buffer.py`

**File:** `tests/sentry/spans/test_buffer.py` (after imports, before `DEFAULT_OPTIONS`)

**What:** Added `pytestmark = [pytest.mark.django_db]`.

**Why:** `flush_segments()` has a code path (`_load_segment_data` → `Project.objects.get_from_cache()`) that requires DB access. Without the marker, this causes "Database access not allowed" under `--dist=load` where tests interleave across workers and pytest-django properly blocks unmarked DB access. Also causes flaky reruns under `--dist=loadfile`. This is a rare case — almost all Sentry tests inherit from `TestCase` (which implicitly grants DB access). `test_buffer.py` is one of the few function-based test files that relies on pytest-django's marker system instead.

### 1c. Fix flaky dashboard widget ordering

**File:** `tests/sentry/dashboards/endpoints/test_organization_dashboard_details.py`

**What:** Added `order=0` to `widget_1`, `order=1` to `widget_2` in the parent `OrganizationDashboardDetailsTestCase.setUp()`, and `order=2` to `widget_3`, `order=3` to `widget_4` in `OrganizationDashboardDetailsPutTest.setUp()`.

**Why:** `DashboardWidget.order` is `BoundedPositiveIntegerField(null=True)`. All four widgets were missing `order=`, leaving them as NULL. `get_widgets()` uses `ORDER BY (order, id)` — PostgreSQL's ordering of NULL values is nondeterministic (heap scan order), causing intermittent assertion failures on widget position. An initial grep for `order=` in the file found `order=0`/`order=1` at lines 70/80, but these were on `DashboardWidgetQuery` objects (queries within widgets), not on `DashboardWidget` itself.

### 1d. Conditional selenium plugin loading

**File:** `src/sentry/testutils/pytest/__init__.py`

**What:** Moved `sentry.testutils.pytest.selenium` out of the static `pytest_plugins` list. It's now appended conditionally only when `SENTRY_SKIP_SELENIUM_PLUGIN != "1"`.

**Why:** selenium is a 23MB package imported at module level. We should avoid loading it when not running acceptance tests. Currently we pass `--ignore tests/acceptance` but that only prevents test collection and not plugin loading.

## 2. xdist Per-Worker Isolation Infrastructure

**Problem:** When pytest-xdist spawns multiple workers (`-n 3`) inside a single shard, all workers share the same Redis, Kafka, Snuba/ClickHouse, and Relay. Without isolation, workers corrupt each other: `flushdb()` wipes another worker's cache, Kafka events cross-pollinate between consumers, `reset_snuba` truncates another worker's data, and identical snowflake IDs cause `IntegrityError` on unique constraints.

**Approach:** Give each worker its own Redis DB number, Kafka topic names, Snuba instance, Relay container, and snowflake ID range. All gated on xdist env vars — **no-ops without them**.

### 2a. xdist helpers + per-worker Redis and Snuba

**New file:** `src/sentry/testutils/pytest/xdist.py` — resolves worker ID once at module level; provides `get_redis_db()`, `get_kafka_topic()`, `get_snuba_url()`.

**Modified:** `src/sentry/testutils/pytest/sentry.py` — Redis cluster settings call `xdist.get_redis_db()` instead of hardcoded `TEST_REDIS_DB`. Snuba URL is overridden via `settings.SENTRY_SNUBA = xdist.get_snuba_url()` in `pytest_configure` before `initialize_app()`. This must happen before `initialize_app` because `sentry.utils.snuba` creates a module-level connection pool singleton (`_snuba_pool`) from `settings.SENTRY_SNUBA` at import time, and `initialize_app` transitively triggers that import.

**Modified:** `src/sentry/testutils/skips.py` — `_requires_snuba` reads port from `SNUBA` env var instead of hardcoded 1218 (per-worker Snuba uses 1230+N).

### 2b. Deterministic region name + per-worker snowflake IDs

**Modified:** `src/sentry/testutils/pytest/sentry.py` (`_configure_test_env_regions`)

Region name RNG is seeded with `PYTEST_XDIST_TESTRUNUID` so all workers generate the same name (xdist requires identical test collection). Each worker gets `region_snowflake_id = worker_num + 1` so concurrent Project/Organization/Team creation produces unique snowflake IDs instead of colliding.

### 2c. Per-worker Kafka topic isolation

**Modified:** `src/sentry/testutils/pytest/kafka.py` — topic names and consumer group ID use `xdist.get_kafka_topic()`.

**Modified:** `src/sentry/testutils/pytest/template/config.yml` — hardcoded `ingest-events`/`outcomes` replaced with `${KAFKA_TOPIC_EVENTS}`/`${KAFKA_TOPIC_OUTCOMES}` template variables.

**Modified:** `src/sentry/testutils/pytest/relay.py` — passes the per-worker topic names as template variables when rendering Relay config.

### 2d. Per-worker Relay container isolation

**Modified:** `src/sentry/testutils/pytest/relay.py`

- Per-worker container names (`sentry_test_relay_server_gw0`) and port offsets (`33331 + worker_num * 100`) to avoid Docker name and port collisions.
- Per-worker Redis DB via `xdist.get_redis_db()`.

### 2e. xdist CI workflow

**New file:** `.github/workflows/backend-xdist.yml` — copy of `backend.yml` with minimal changes: triggers on `mchen/tiered-xdist-v2` branch, adds `PYTHONHASHSEED=0`, `XDIST_PER_WORKER_SNUBA=1`, `SENTRY_SKIP_SELENIUM_PLUGIN=1`, per-worker Snuba bootstrap step, and runs pytest with `-n 3 --dist=loadfile` instead of `make test-python-ci`. Per-worker Snuba bootstrap runs all 3 instances in parallel (`&` + `wait`) — sequential bootstrap takes ~55s per worker (~165s total), parallel brings it down to ~55s.

### 2f. Disable rerunfailures crash recovery

**Modified:** `tests/conftest.py`

Sets `pytest_rerunfailures.HAS_PYTEST_HANDLECRASHITEM = False`.

**Root cause:** `sentry/conf/server.py` line 40 sets `socket.setdefaulttimeout(5)`, a global default for all newly created sockets. When `pytest-rerunfailures` creates its crash recovery server, it calls `setblocking(1)` on the listening socket (overriding the default to no timeout). But `socket.accept()` creates a *new* socket for each accepted connection, and Python docs specify that new sockets inherit their timeout from `socket.getdefaulttimeout()`, not from the listening socket. So each accepted connection has a 5-second timeout.

Under xdist, the server spawns a `run_connection` thread per worker. Each thread blocks on `conn.recv(1)` waiting for the next message. If no message arrives within 5 seconds (e.g., during heavy Django/plugin initialization or between test batches), `recv` raises `TimeoutError`, the thread dies, and crash recovery for that worker is lost. With 3 workers, all 3 threads die during startup, producing the `Exception in thread Thread-N (run_connection)` errors.

The 5s timeout is hit because the `ClientStatusDB` connects during `pytest_configure`, but doesn't send any data until a test actually runs. Between connection and first message, the worker does Django initialization (~10s) and test collection (~100s). The server's `run_connection` thread is waiting on `recv(1)` that entire time and dies after 5s. The client still has its socket open but the server side is gone.

Normal `--reruns` is unaffected — each worker retries failed tests locally via `StatusDB` (in-memory, no sockets). Only segfault crash recovery (reassigning a dead worker's test to another worker) is lost, which is a rare edge case.

## 3. Skip Redundant Test Collection in calculate-shards

**Modified:** `.github/workflows/backend.yml`, `.github/workflows/backend-xdist.yml`

The `calculate-shards` job now has a fast path: when selective testing isn't active (push to master/branch), it outputs static defaults (22 shards) without checkout, setup-sentry, or `pytest --collect-only`. Saves ~3 min on the critical path. When selective testing IS active (PR), the full collection pipeline still runs to compute the right shard count.

### 2g. Snowflake test fix

**Modified:** `tests/sentry/utils/test_snowflake.py`

Two tests hardcode expected snowflake values assuming `region_snowflake_id=0`. Under xdist, workers use `worker_num + 1` (from 2b). Fix: wrap in `override_regions` with explicit `Region("test-region", 0, ...)` so expected values are deterministic.

## 4. Independent Optimizations

### 4a. Postgres Unix socket support

**Files:** `src/sentry/testutils/pytest/sentry.py` (`pytest_configure`), workflow YAML

**Intuition:** Every Postgres query goes through TCP loopback (`127.0.0.1:5432`). Even on localhost, each query pays the full kernel TCP stack cost: user→kernel buffer copy, TCP header packaging, loopback routing, kernel→user buffer copy, TCP ACK handling. Each round-trip is ~30-50μs. A Unix domain socket (`/tmp/pg-sock/.s.PGSQL.5432`) skips the TCP stack entirely — direct memory copy through the kernel, ~10-15μs per round-trip.

The per-query savings are tiny, but Sentry's test suite does hundreds of thousands of Postgres round-trips per shard: every ORM query, every SAVEPOINT/ROLLBACK (2 per test × 3 databases × thousands of tests = ~192K round-trips just for test isolation), every fixture creation. At this volume, the 20-35μs savings per round-trip compounds. The experiment branch measured T1 max dropping 36s and runner-minutes dropping 7m.

**Safety:** This is purely a transport-layer change. The SQL queries, results, transaction semantics, SAVEPOINT behavior, connection pooling — everything above the socket is identical. Postgres uses the same wire protocol over Unix sockets as TCP. `psycopg2` connects via `AF_UNIX` instead of `AF_INET`, but the application sees no difference. There are no subtle correctness risks — if the socket file doesn't exist or has wrong permissions, the connection fails immediately with a clear error.

**Code change:** Add `SENTRY_DB_SOCKET` env var handling in `pytest_configure` before `configure_split_db()` so the HOST override propagates to control/secondary databases:
```python
if _pg_socket := os.environ.get("SENTRY_DB_SOCKET"):
    settings.DATABASES["default"]["HOST"] = _pg_socket
    settings.DATABASES["default"]["PORT"] = ""
```

**Workflow change:** Restart the postgres container with a socket volume mount, then set `SENTRY_DB_SOCKET=/tmp/pg-sock` in the workflow env.

### 4b. Relay container session scope

**File:** `src/sentry/testutils/pytest/relay.py`

Three changes:
- `relay_server_setup` broadened from `module` → `session` scope. Container start + health check moved into it from `relay_server`. One container per worker session instead of per test.
- `relay_server` slimmed to: adjust settings + re-insert Relay DB row + yield URL. The DB row insertion (reading `template/credentials.json`) is needed because 4 of 6 relay test files use `TransactionTestCase` which flushes the DB between tests, deleting the Relay identity row.
- `import json` added for reading credentials file.

## 5. Tiered Workflow

### 5a. Service classifier plugin + classify workflow

New `service_classifier.py` plugin, registered in `__init__.py`. New `classify-services.yml` workflow (`workflow_dispatch` only) that runs the classifier across 22 shards and merges reports into a single `test-service-classification.json` artifact.

Each test is tagged with the **union** of static and runtime detection. Static detection checks fixture declarations (`_requires_snuba`, `_requires_kafka`, etc.) at collection time. Runtime detection monkey-patches `socket.send`/`socket.sendall` and checks `getpeername()` port during test execution. Static alone isn't sufficient because some tests call Snuba indirectly through application code without declaring a fixture. Runtime alone isn't sufficient because some fixtures (Kafka, Symbolicator) configure services without always producing detectable socket traffic. The union covers both cases — a test is classified as needing a service if either method detects it. Misclassifications can only go one direction: false positives (test tagged with a service it doesn't need) just run on T2 instead of T1 — slower but correct. False negatives (test needs a service but wasn't tagged) fail loudly with a `ConnectionError: Connection refused` when the test tries to reach the missing service, making them immediately obvious in CI. In the rare case where application code silently catches the connection error and falls back to a default, the test assertions should catch the empty/wrong result. No manual override list is needed — misclassifications are caught by running CI and fixed by rerunning the classifier.

### 5b. Split-tests-by-tier script + tiered workflow

**New file:** `.github/workflows/scripts/split-tests-by-tier.py` — reads classification JSON, splits test files into tier1 (postgres-only) and tier2 (needs Snuba/Kafka/etc.) based on `TIER2_SERVICES` set. Supports file and class granularity. Validates classification isn't empty.

**Modified:** `.github/workflows/backend.yml` — three new jobs added alongside the existing `backend-test`:

- **`split-tiers`**: Downloads latest classification artifact from `classify-services.yml`, runs the split script, uploads `backend-light-tests.txt` and `backend-tests.txt`. Only runs when selective testing is NOT active (i.e., push to master / workflow_dispatch). If no classification run exists, outputs `has-tiers=false` and the tier path is skipped gracefully.

- **`backend-light`**: 5 shards, `-n 4 --dist=loadfile`, `mode: migrations` (postgres + redis only). Uses GitHub Actions service containers for Kafka, redis-cluster, and Zookeeper (needed because app code produces to Kafka even without Snuba). No Snuba bootstrap. Runs ~71% of tests that don't need the full stack.

- **`backend-test` (modified)**: When tiers are active, its `SELECTED_TESTS_FILE` points to `backend-tests.txt` (tier2 tests only, ~29%). When selective testing is active or tiers aren't available, it runs as before with the full test suite. No structural changes to this job — just an additional artifact download step and a conditional `SELECTED_TESTS_FILE`.

**Design decisions:**
- Selective testing and tiered testing are mutually exclusive. PRs use selective testing (existing path). Master pushes use tiers.
- The existing `backend-test` job doubles as the tier2 path — no duplication of the full-stack job configuration.
- `calculate-shards` is kept for the selective testing path. Tier shard counts are hardcoded (5 + 22).
- `backend-required-check` updated to include `backend-light` and `split-tiers`.

## 6. Tiered Workflow Optimizations

### 6a. G1: Skip irrelevant test file imports

**Modified:** `src/sentry/testutils/pytest/sentry.py`

Added `pytest_ignore_collect` hook. When `SELECTED_TESTS_FILE` is set, prevents pytest from importing test files not in the tier's list. Runs before module import — Python never loads the irrelevant files, saving ~50s of collection time per shard. Directories, conftest files, non-`.py` files, and files outside `tests/` all pass through. No-op without `SELECTED_TESTS_FILE`. Reduces runner-minutes across all shards since every shard pays the collection cost.

### 6b. H1: Overlapped startup

**Modified:** `src/sentry/testutils/pytest/sentry.py`, `src/sentry/testutils/skips.py`, `.github/workflows/backend.yml`

Both backend-light and backend-test jobs now use `skip-devservices: true` on `setup-sentry` and start services in a background subshell while pytest runs in the foreground. Pytest collection (~77s) overlaps with service startup (~17s on T1, ~120s on T2), saving the overlap window per shard.

**Python-side changes:**
- `wait_for_services` session fixture in `sentry.py`: polls for `SERVICES_READY_FILE` sentinel file. Runs after collection, blocks before first test. No-op without the env var.
- `_wait_for_service()` + `SNUBA_WAIT_TIMEOUT` in `skips.py`: `_requires_snuba` polls for the per-worker Snuba port instead of failing immediately when it's not yet up.

**Workflow changes:**
- Both tier jobs use `skip-devservices: true` on `setup-sentry`, then a single combined step that backgrounds service startup (devservices + pg-socket + Snuba bootstrap on T2) while running pytest in the foreground. The background subshell touches `/tmp/services-ready` when all services are healthy.
- T1 and T2 use the same pattern for consistency. T1's background subshell is simpler (no Snuba bootstrap).

**Why this is safe:** `initialize_app()` (called in `pytest_configure`) does not touch Postgres, Redis, Snuba, or any external service. We verified this by auditing every `ready()` method across all Django apps — they all do pure Python registration (imports, plugin registration, signal receivers). `SENTRY_SKIP_SERVICE_VALIDATION=1` (set by `setup-sentry` on every CI shard since before our changes) skips the only Redis call in `pytest_configure`. Test collection also needs no services — it just discovers test functions via Python imports. Services are only needed when the first test actually executes, which is after `wait_for_services` has confirmed they're ready.

### 6c. Fix: `wait_for_services` timeout and silent failure

**Modified:** `src/sentry/testutils/pytest/sentry.py`, `.github/workflows/backend.yml`

**What:** Changed `wait_for_services` timeout env var from `SNUBA_WAIT_TIMEOUT` (180s) to `SERVICES_WAIT_TIMEOUT` (300s). Timeout now calls `pytest.fail()` instead of silently `break`ing.

**Why:** On GitHub Actions runners without cached Docker images, pulling clickhouse (~500MB) and snuba (~300MB) can take 14+ minutes. The original 180s timeout expired silently, allowing tests to start before services were ready. This caused all Snuba-dependent tests to fail on first attempt, burn through `--reruns=5` retries, and waste minutes of runner time. Observed on shard 10 of run 22653949065: 7 images pulled in 36s (cached), clickhouse + snuba took 14 minutes (uncached). The 300s timeout covers typical slow pulls, and `pytest.fail()` ensures any remaining edge case fails fast with a clear message instead of silently degrading.
