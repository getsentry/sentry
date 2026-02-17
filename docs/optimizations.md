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

**pytest-rerunfailures socket deadlock** (`tests/conftest.py`):
- `pytest-rerunfailures` 15.0 auto-detects xdist and creates a TCP socket server (controller) + client (each worker) for crash recovery — tracking rerun counts centrally so the controller can rerun tests whose worker was killed by a segfault.
- The socket protocol uses single-byte `recv(1)` with a timeout. During heavy xdist startup (Django, plugins, per-worker Snuba), workers haven't connected by the time the controller threads time out. All threads die, and the controller deadlocks waiting for status updates that never arrive. Every shard freezes.
- **Fix:** `pytest_rerunfailures.HAS_PYTEST_HANDLECRASHITEM = False` in `conftest.py`. Forces the in-memory `StatusDB` fallback. Normal `--reruns=5` still works — each worker retries locally. Only segfault crash recovery is lost (rare edge case).

**Quirks:**
- The module-level env var + session fixture is belt-and-suspenders: the env var covers Django settings load, the fixture covers the `_snuba_pool` singleton in case of unexpected import ordering.
- `--dist=loadfile` groups tests from the same file onto one worker, maximizing fixture reuse (module/class-scoped fixtures run once instead of per-worker).

**Snowflake test fix** (`tests/sentry/utils/test_snowflake.py`):
- `test_generate_correct_ids` and `test_generate_correct_ids_with_region_sequence` hardcode expected snowflake values assuming `region_snowflake_id=0`. Under xdist, workers use `worker_num + 1`, shifting the region segment.
- **Fix:** Wrap both tests in `override_regions` with an explicit `Region("test-region", 0, ...)` so expected values are deterministic regardless of xdist worker.

**Results** (run `22112621345`, 22 shards × 3 workers):

| Metric | Value |
|---|---|
| Wall clock | 13.6m |
| Avg shard time | 12.2m |
| Max / Min | 13.6m / 9.8m |
| Spread | 224s |
| Runner-minutes | 268m |

Phase breakdown (avg, as % of wall clock):
- Setup sentry env: 48s (5.9%)
- Bootstrap per-worker Snuba: 55s (6.7%)
- Run backend tests: 564s / 9.4m (69.2%)

Failures: 2/22 — both `test_snowflake.py` (fixed above). All other tests passed.

---

## Step 3: Overlapped Startup (H1)

**What:** Run `devservices up` + per-worker Snuba bootstrap in a background subshell while pytest starts immediately. Pytest collection (~100-120s) doesn't need services — it only discovers test functions. By overlapping, we save ~80-100s of setup time per shard.

**Workflow changes:**
- `skip-devservices: true` in `setup-sentry` — prevents the action from starting devservices synchronously.
- Single combined step: background subshell runs `sentry init` → `devservices up` → parallel per-worker bootstrap, while foreground starts pytest immediately.
- Per-worker bootstrap runs in parallel (`&` + `wait`) instead of sequentially.
- `SNUBA_WAIT_TIMEOUT: '180'` — tells `_requires_snuba` to poll instead of failing.
- `DJANGO_LIVE_TEST_SERVER_ADDRESS: '172.17.0.1'` — Docker bridge gateway for relay tests.

**`_requires_snuba` polling** (`skips.py`):
- Added `_wait_for_service()` that polls `socket.create_connection` every 1s up to `SNUBA_WAIT_TIMEOUT`.
- When `SNUBA_WAIT_TIMEOUT > 0`, `_requires_snuba` waits for the per-worker Snuba port instead of immediately failing. This is the bridge that lets pytest collection proceed while services are still starting.

**Expected savings:** Step 2 showed 48s setup + 55s bootstrap = 103s sequential overhead. With H1, most of this overlaps with collection. Net saving ~80-100s per shard.

**Results** (run `22113448082`, 22 shards × 3 workers, all passed):

| Metric | Step 2 | Step 3 | Delta |
|---|---|---|---|
| Wall clock | 13.6m | 12.1m | -1.5m (11%) |
| Avg shard | 12.2m | 11.2m | -1.0m |
| Max / Min | 13.6m / 9.8m | 12.1m / 9.7m | |
| Spread | 224s | 142s | -82s |
| Runner-minutes | 268m | 247m | -21m |

Setup + bootstrap is no longer visible as a separate phase — it overlaps with collection.
The 1.5m wall-clock savings (103s sequential overhead → overlapped) matches the expected ~80-100s.

---

## Step 4: Two-Tier Split (5T1 / 17T2)

**What:** Split tests by service dependency into two tiers. Tier 1 (5 shards) runs ~71% of tests with Postgres + Redis only (`migrations` mode, no Snuba). Tier 2 (17 shards) runs ~29% of tests with the full stack + per-worker isolation + H1.

**New files:**
- `split-tests-by-tier.py` — reads classification JSON, outputs tier1/tier2 test lists. Supports `--granularity file|class|test`.
- Workflow restructured from 1 job to 3 jobs: `split-tiers` → `tier1` + `tier2` in parallel.

**`sentry.py` change:** `SELECTED_TESTS_FILE` filtering now respects `TIER_GRANULARITY` env var (file/class/test matching).

**Tier 1 service containers:** Kafka, Zookeeper, and redis-cluster run as GitHub Actions `services:` containers. Kafka is bundled with Snuba in devservices and can't be started alone, but app code (`on_commit` hooks like `invalidate_project_config`) produces to Kafka even for non-Snuba tests.

**Classifier gap — objectstore runtime detection:**
Initial tier1 runs failed on `test_preprod_artifact_snapshot.py` (500 errors). Root cause: the endpoint calls `get_preprod_session().put()` to upload to objectstore (port 8888), but:
1. The test lacks a `requires_objectstore` fixture marker (static detection misses it).
2. `SERVICE_PORTS` in `service_classifier.py` only had snuba (1218) and bigtable (8086) — objectstore (8888) was missing from runtime detection.

**Fix:** Added objectstore (8888) and symbolicator (3021) to `SERVICE_PORTS` so runtime detection catches implicit dependencies. Also added the file to `FORCE_TIER2_FILES` as an immediate workaround (classification data is pre-generated and won't update until the classifier reruns).

**Testing:** 3 parallel worktrees comparing file/class/test granularity (`--dist=loadfile`).

**Results — `--dist=loadfile`** (runs `22114412739`, `22114413407`, `22114413637`, all passed):

| Metric | Step 3 | File | Class | Test |
|---|---|---|---|---|
| Wall clock | 12.1m | **12.4m** | 12.7m | 13.0m |
| T1 avg / max | — | 9.8m / 10.8m | 11.0m / 11.4m | 11.2m / 11.7m |
| T2 avg / max | — | 9.9m / 11.0m | 9.6m / 10.4m | 9.5m / 10.2m |
| T1 spread | — | 137s | 36s | 73s |
| T2 spread | — | 161s | 105s | 74s |
| Runner-min | 247m | **216m** | 219m | 218m |

Wall clock did not improve — tier1 (5 shards, ~71% of tests) is overloaded relative to tier2 (17 shards, ~29%). The win is runner-minutes: 247m → 216m (−13%) since tier1 skips the Snuba/devservices stack.

File granularity outperformed class/test on runner-minutes because:
1. The 5:17 shard ratio means moving tests from tier2→tier1 (finer granularity) costs `duration/5` but saves only `duration/17`.
2. `--dist=loadfile` aligns perfectly with file-level tier boundaries — no wasted partial-file imports.

**Results — `--dist=load`** (runs `22115067011`, `22115087951`, `22115092297`, `22115096011`, all passed):

**File granularity:**

| Metric | loadfile | load |
|---|---|---|
| Wall clock | 12.4m | 12.2m |
| T1 avg / max | 9.8m / 10.8m | 10.5m / 11.2m |
| T2 avg / max | 9.9m / 11.0m | 10.0m / 10.9m |
| T1 spread | 137s | 129s |
| T2 spread | 161s | 150s |
| Runner-min | 216m | 222m |

**Class granularity:**

| Metric | loadfile | load |
|---|---|---|
| Wall clock | 12.7m | 13.1m |
| T1 avg / max | 11.0m / 11.4m | 11.6m / 11.9m |
| T2 avg / max | 9.6m / 10.4m | 9.5m / 10.2m |
| T1 spread | 36s | 34s |
| T2 spread | 105s | 114s |
| Runner-min | 219m | 220m |

**Test granularity:**

| Metric | loadfile | load |
|---|---|---|
| Wall clock | 13.0m | 13.6m |
| T1 avg / max | 11.2m / 11.7m | 12.3m / 12.6m |
| T2 avg / max | 9.5m / 10.2m | 9.5m / 10.6m |
| T1 spread | 73s | 41s |
| T2 spread | 74s | 120s |
| Runner-min | 218m | 223m |

`--dist=load` did not improve over `--dist=loadfile`. Runner-minutes increased (216→222 for file granularity) and wall clock was similar or worse. Per-test dispatching overhead outweighs any worker utilization gains. `--dist=loadfile` remains the better choice, particularly at file granularity.

**Results — `--dist=loadscope`** (runs `22115158205`, `22115168046`, `22115176096`, all passed):

**File granularity:**

| Metric | loadfile | load | loadscope |
|---|---|---|---|
| Wall clock | 12.4m | 12.2m | **11.9m** |
| T1 avg / max | 9.8m / 10.8m | 10.5m / 11.2m | 9.8m / 10.8m |
| T2 avg / max | 9.9m / 11.0m | 10.0m / 10.9m | 9.9m / 10.7m |
| T1 spread | 137s | 129s | 153s |
| T2 spread | 161s | 150s | **133s** |
| Runner-min | **216m** | 222m | 217m |

**Class granularity:**

| Metric | loadfile | load | loadscope |
|---|---|---|---|
| Wall clock | 12.7m | 13.1m | **12.8m** |
| T1 avg / max | 11.0m / 11.4m | 11.6m / 11.9m | 10.8m / 11.7m |
| T2 avg / max | 9.6m / 10.4m | 9.5m / 10.2m | 9.6m / 10.7m |
| T1 spread | 36s | 34s | 89s |
| T2 spread | 105s | 114s | 155s |
| Runner-min | 219m | 220m | **217m** |

**Test granularity:**

| Metric | loadfile | load | loadscope |
|---|---|---|---|
| Wall clock | 13.0m | 13.6m | **13.2m** |
| T1 avg / max | 11.2m / 11.7m | 12.3m / 12.6m | 11.5m / 11.8m |
| T2 avg / max | 9.5m / 10.2m | 9.5m / 10.6m | 9.3m / 10.0m |
| T1 spread | 73s | 41s | 38s |
| T2 spread | 74s | 120s | 106s |
| Runner-min | 218m | 223m | **216m** |

**Summary:** `loadscope` is consistently the best or tied for best across all granularities. Best overall: **loadscope + file at 11.9m / 217m**. `load` (per-test dispatching) is consistently worst — overhead outweighs utilization gains. File granularity wins across all dist modes, confirming the 5:17 shard imbalance as the dominant factor. Differences between dist modes are small (~0.5m); shard rebalancing or three-tier split would have bigger impact.

---

## Baseline comparison: how the baseline branch achieved 11m29s

The baseline branch (commit `87b94db`, run `21929461389`) achieved **11m29s wall clock** with the same 5T1/17T2 shard split and file-level classification. Configuration:

- **Sharding:** `TEST_GROUP_STRATEGY: roundrobin` — hashes each individual test's full nodeid (`sha256(nodeid) % total_groups`), giving statistically even per-test distribution across shards.
- **Dist mode:** `--dist=loadfile`
- **Workers:** `-n 3` on ubuntu-24.04 (4-core, 16GB)
- **Granularity:** File-level tier classification
- **Tier split:** 5 tier1 / 17 tier2

**Baseline timing (run 21929461389):**

| | Avg | Max | Min | Spread |
|---|---|---|---|---|
| Tier 1 (5) | 10m15s | 10m25s | 10m04s | **21s** |
| Tier 2 (17) | 9m41s | 11m08s | 8m12s | 176s |
| Wall clock | — | **11m29s** | — | — |

**Our best (loadscope + file):**

| | Avg | Max | Min | Spread |
|---|---|---|---|---|
| Tier 1 (5) | 9m46s | 10m49s | 8m16s | **153s** |
| Tier 2 (17) | 9m53s | 10m41s | 8m28s | 133s |
| Wall clock | — | **11m56s** | — | — |

**Gap analysis (27s):**

The 27-second gap is almost entirely explained by **Tier 1 shard balance**. The baseline's T1 spread was 21s vs our 153s. With per-test hash sharding, each of the 5 tier1 shards gets a statistically uniform slice of ~14% of tests. Our round-robin distributes at file granularity (entire files to shards), which is clumpier — one shard can draw several large files and become a hotspot.

**What the baseline evolved to after 11m29s:**

The baseline continued iterating beyond the 11m29s configuration:

1. **Iteration 19: Test-level classification + 6/16 shard rebalance** — Split at test granularity, moved 1 shard from T2→T1 (6T1/16T2). Achieved 11m30s (parity). This created headroom for further tier reductions.

2. **Iteration 20: Reclassification (Optimization D)** — Removed `_requires_snuba` from fixture-based detection, switched to runtime-only socket monitoring. Reclassified ~1,844 tests that inherited `SnubaTestCase` but never actually queried Snuba, moving them from T2→T1.

3. **Three-tier split (tier2-light / tier2-heavy)** — Separated tier2 into: `tier2-light` (14 shards, Snuba only, `backend-ci-light` mode) and `tier2-heavy` (1 shard, full stack with symbolicator/objectstore/bigtable). New `backend-ci-light` devservices mode skips pulling heavy images.

4. **Docker image pre-pull (F1)** — Background-pull locally-defined images during setup-sentry overlap.

5. **Shard balancing (I1)** — Identified as the biggest remaining lever (reduce 134s spread to ~30-50s).

**Final baseline state (7T1 / 15T2, run 21974448623):**

| | Avg | Max | Spread |
|---|---|---|---|
| Tier 1 (7) | 10m33s | 11m20s | 134s |
| Tier 2 (15) | 9m55s | 11m00s | 134s |
| Wall clock | — | **~11m40s** | — |

**Key takeaways for our clean branch:**

1. **Shard balance is the #1 remaining lever.** The baseline's 21s T1 spread vs our 153s accounts for most of the wall-clock gap. Per-test hash sharding or sorted round-robin would close this.
2. **Three-tier split** saves tier2 startup time by skipping heavy images for the majority of tier2 shards.
3. **Reclassification** (runtime-only Snuba detection) can move ~1,800 more tests to tier1, reducing T2 load.
4. **Shard count tuning** (6T1/16T2 or 7T1/15T2) better matches the actual workload distribution.
