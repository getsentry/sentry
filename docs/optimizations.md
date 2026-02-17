# Backend CI Optimizations

Incremental optimizations to the backend test CI pipeline. Each entry describes what was done, why, any quirks, and measured results.

## Metrics Key

- **Wall clock**: total time from first shard start to last shard finish
- **Avg shard time**: mean duration across all shards (per-tier if applicable)
- **Max / Min**: slowest and fastest individual shard
- **Spread**: max - min (measures balance)
- **Runner-minutes**: sum of all shard durations (measures cost)

---

## Step 1: Service Classifier

**What:** Pytest plugin (`service_classifier.py`) that maps each test to its external service dependencies (Snuba, Kafka, Postgres, etc.).

**How:** Hybrid static + runtime detection:
- *Static* (collection time): Checks fixtures (`_requires_snuba`, `_requires_kafka`, etc.), class inheritance for Postgres, and a hardcoded file list for Bigtable.
- *Runtime* (test execution): Monkey-patches `socket.send`/`socket.sendall`, checks `getpeername()` port to detect actual Snuba traffic (port 1218).

**Why hybrid?** Pure static misses tests that call Snuba indirectly through application code without the `_requires_snuba` fixture. Pure runtime misses services configured by fixtures that don't always produce detectable socket calls (Kafka, Symbolicator).

**Quirks:**
- Bigtable detection is hardcoded by file path (4 files) — no fixture or runtime detection exists for it.
- Opt-in via `--classify-services` flag; zero overhead when disabled.
- Runs in a separate CI workflow (`classify-services.yml`), not during normal test execution.

**Output:** `test-service-classification.json` — consumed by `split-tests-by-tier.py` in later steps.

**Results:** N/A (tooling only, no impact on test execution time).

---

## Step 2: pytest-xdist + Per-Worker Isolation

**What:** Run each of the 22 shards with `pytest-xdist -n 3 --dist=loadfile`, tripling in-shard parallelism. Requires isolating every piece of shared mutable state so workers don't corrupt each other.

**Workflow** (`backend-xdist-split-poc.yml`, new file based on `backend.yml` with minimal delta):
- `PYTHONHASHSEED: '0'` — xdist requires identical test collection order across workers; Python hash randomization breaks this.
- `XDIST_PER_WORKER_SNUBA: '1'`, `XDIST_WORKERS: '3'` — env vars that signal per-worker routing to the pytest plugin.
- `-n 3 --dist=loadfile` added to pytest command — 3 parallel workers per shard, grouped by file to share fixtures.
- Per-worker bootstrap step: creates ClickHouse databases (`default_gw0/1/2`), runs `snuba bootstrap --force` for each, starts per-worker Snuba containers on ports 1230+N.

**Per-worker Snuba** (`sentry.py`):
- Module-level `os.environ["SNUBA"]` set to `http://127.0.0.1:{1230+N}` before Django settings load (`SENTRY_SNUBA = os.environ.get("SNUBA", ...)` in `server.py`).
- Session fixture patches `_snuba_pool` (module-level connection pool in `sentry.utils.snuba`) as safety net.
- Without this, all workers share one Snuba instance and `reset_snuba` (`TRUNCATE TABLE`) wipes data across workers mid-test.

**Per-worker Redis DB** (`sentry.py`):
- `_get_xdist_redis_db()` returns `TEST_REDIS_DB + worker_num`, wired into `settings.SENTRY_OPTIONS["redis.clusters"]`.
- Without this, `flushdb()` in teardown wipes the entire Redis DB — destroying other workers' snowflake counters, caches, and rate limiter state.

**Per-worker Kafka topics** (`sentry.py`, `kafka.py`, `relay.py`, `template/config.yml`):
- `_get_xdist_kafka_topic(base)` appends `-{worker_id}` to topic names (`ingest-events`, `outcomes`) and consumer group ID (`test-consumer`).
- Relay's `config.yml` template changed from hardcoded topic names to `${KAFKA_TOPIC_EVENTS}` / `${KAFKA_TOPIC_OUTCOMES}`.
- Without this, Relay events from worker A land in worker B's consumer, causing test pollution.

**Deterministic region name** (`sentry.py`):
- Seeds `random.Random` with `PYTEST_XDIST_TESTRUNUID` (shared across workers per session, unique per run).
- Without this, each worker generates a different random region name during `pytest_configure`, causing test collection order to diverge — xdist crashes.

**Per-worker snowflake IDs** (`sentry.py`):
- Sets `region_snowflake_id = worker_num + 1` (12-bit field, 0–4095 range).
- Without this, concurrent workers generate identical snowflake IDs, causing `IntegrityError` on unique constraints when creating Projects, Organizations, etc.

**Relay container isolation** (`relay.py`):
- Per-worker Docker container names (`sentry_test_relay_server_{worker_id}`) and port offsets (`33331 + worker_num * 100`) — avoids Docker name and port collisions.
- Class-scoped container (`_relay_container`) instead of function-scoped — one Docker start per class (~10) instead of per test (~75), saving ~650s of lifecycle overhead.
- `_ensure_relay_in_db()` re-inserts the Relay model row before each test — `TransactionTestCase` flushes the DB between tests, deleting the row Sentry uses to authenticate Relay (401 without it). Values sourced from `template/credentials.json`.

**Snuba port detection** (`skips.py`):
- `_requires_snuba` reads the `SNUBA` env var to check the per-worker port (1230+N) instead of hardcoded 1218.
- Without this, the fixture checks the shared Snuba and may pass even if the per-worker instance is down.

**Quirks:**
- The module-level env var + session fixture is belt-and-suspenders: the env var covers Django settings load, the fixture covers the `_snuba_pool` singleton in case of unexpected import ordering.
- `--dist=loadfile` groups tests from the same file onto one worker, maximizing fixture reuse (module/class-scoped fixtures run once instead of per-worker).

**Results:** TBD
