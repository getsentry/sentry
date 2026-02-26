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

**File:** `tests/sentry/dashboards/endpoints/test_organization_dashboard_details.py` (lines 918, 924)

**What:** Added `order=2` to `widget_3` and `order=3` to `widget_4` in `OrganizationDashboardDetailsPutTest.setUp()`.

**Why:** `DashboardWidget.order` is `BoundedPositiveIntegerField(null=True)`. The parent class already sets `order=0` and `order=1` on `widget_1`/`widget_2`, but `widget_3`/`widget_4` were left as NULL. `ORDER BY order` with NULL values produces nondeterministic ordering in PostgreSQL, causing intermittent assertion failures on widget position.

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

**New file:** `.github/workflows/backend-xdist.yml` — copy of `backend.yml` with minimal changes: triggers on `mchen/tiered-xdist-v2` branch, adds `PYTHONHASHSEED=0`, `XDIST_PER_WORKER_SNUBA=1`, `SENTRY_SKIP_SELENIUM_PLUGIN=1`, per-worker Snuba bootstrap step, and runs pytest with `-n 3 --dist=loadfile` instead of `make test-python-ci`.

### 2f. Snowflake test fix

**Modified:** `tests/sentry/utils/test_snowflake.py`

Two tests hardcode expected snowflake values assuming `region_snowflake_id=0`. Under xdist, workers use `worker_num + 1` (from 2b). Fix: wrap in `override_regions` with explicit `Region("test-region", 0, ...)` so expected values are deterministic.
