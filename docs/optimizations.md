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

- _Static_ (collection time): Checks fixtures (`_requires_snuba`, `_requires_kafka`, etc.), class inheritance for Postgres, and a hardcoded file list for Bigtable.
- _Runtime_ (test execution): Monkey-patches `socket.send`/`socket.sendall`, checks `getpeername()` port to detect actual Snuba traffic (port 1218).

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

| Metric         | Value        |
| -------------- | ------------ |
| Wall clock     | 13.6m        |
| Avg shard time | 12.2m        |
| Max / Min      | 13.6m / 9.8m |
| Spread         | 224s         |
| Runner-minutes | 268m         |

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

| Metric         | Step 2       | Step 3       | Delta       |
| -------------- | ------------ | ------------ | ----------- |
| Wall clock     | 13.6m        | 12.1m        | -1.5m (11%) |
| Avg shard      | 12.2m        | 11.2m        | -1.0m       |
| Max / Min      | 13.6m / 9.8m | 12.1m / 9.7m |             |
| Spread         | 224s         | 142s         | -82s        |
| Runner-minutes | 268m         | 247m         | -21m        |

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

| Metric       | Step 3 | File         | Class         | Test          |
| ------------ | ------ | ------------ | ------------- | ------------- |
| Wall clock   | 12.1m  | **12.4m**    | 12.7m         | 13.0m         |
| T1 avg / max | —      | 9.8m / 10.8m | 11.0m / 11.4m | 11.2m / 11.7m |
| T2 avg / max | —      | 9.9m / 11.0m | 9.6m / 10.4m  | 9.5m / 10.2m  |
| T1 spread    | —      | 137s         | 36s           | 73s           |
| T2 spread    | —      | 161s         | 105s          | 74s           |
| Runner-min   | 247m   | **216m**     | 219m          | 218m          |

Wall clock did not improve — tier1 (5 shards, ~71% of tests) is overloaded relative to tier2 (17 shards, ~29%). The win is runner-minutes: 247m → 216m (−13%) since tier1 skips the Snuba/devservices stack.

File granularity outperformed class/test on runner-minutes because:

1. The 5:17 shard ratio means moving tests from tier2→tier1 (finer granularity) costs `duration/5` but saves only `duration/17`.
2. `--dist=loadfile` aligns perfectly with file-level tier boundaries — no wasted partial-file imports.

**Results — `--dist=load`** (runs `22115067011`, `22115087951`, `22115092297`, `22115096011`, all passed):

**File granularity:**

| Metric       | loadfile     | load          |
| ------------ | ------------ | ------------- |
| Wall clock   | 12.4m        | 12.2m         |
| T1 avg / max | 9.8m / 10.8m | 10.5m / 11.2m |
| T2 avg / max | 9.9m / 11.0m | 10.0m / 10.9m |
| T1 spread    | 137s         | 129s          |
| T2 spread    | 161s         | 150s          |
| Runner-min   | 216m         | 222m          |

**Class granularity:**

| Metric       | loadfile      | load          |
| ------------ | ------------- | ------------- |
| Wall clock   | 12.7m         | 13.1m         |
| T1 avg / max | 11.0m / 11.4m | 11.6m / 11.9m |
| T2 avg / max | 9.6m / 10.4m  | 9.5m / 10.2m  |
| T1 spread    | 36s           | 34s           |
| T2 spread    | 105s          | 114s          |
| Runner-min   | 219m          | 220m          |

**Test granularity:**

| Metric       | loadfile      | load          |
| ------------ | ------------- | ------------- |
| Wall clock   | 13.0m         | 13.6m         |
| T1 avg / max | 11.2m / 11.7m | 12.3m / 12.6m |
| T2 avg / max | 9.5m / 10.2m  | 9.5m / 10.6m  |
| T1 spread    | 73s           | 41s           |
| T2 spread    | 74s           | 120s          |
| Runner-min   | 218m          | 223m          |

`--dist=load` did not improve over `--dist=loadfile`. Runner-minutes increased (216→222 for file granularity) and wall clock was similar or worse. Per-test dispatching overhead outweighs any worker utilization gains. `--dist=loadfile` remains the better choice, particularly at file granularity.

**Results — `--dist=loadscope`** (runs `22115158205`, `22115168046`, `22115176096`, all passed):

**File granularity:**

| Metric       | loadfile     | load          | loadscope    |
| ------------ | ------------ | ------------- | ------------ |
| Wall clock   | 12.4m        | 12.2m         | **11.9m**    |
| T1 avg / max | 9.8m / 10.8m | 10.5m / 11.2m | 9.8m / 10.8m |
| T2 avg / max | 9.9m / 11.0m | 10.0m / 10.9m | 9.9m / 10.7m |
| T1 spread    | 137s         | 129s          | 153s         |
| T2 spread    | 161s         | 150s          | **133s**     |
| Runner-min   | **216m**     | 222m          | 217m         |

**Class granularity:**

| Metric       | loadfile      | load          | loadscope     |
| ------------ | ------------- | ------------- | ------------- |
| Wall clock   | 12.7m         | 13.1m         | **12.8m**     |
| T1 avg / max | 11.0m / 11.4m | 11.6m / 11.9m | 10.8m / 11.7m |
| T2 avg / max | 9.6m / 10.4m  | 9.5m / 10.2m  | 9.6m / 10.7m  |
| T1 spread    | 36s           | 34s           | 89s           |
| T2 spread    | 105s          | 114s          | 155s          |
| Runner-min   | 219m          | 220m          | **217m**      |

**Test granularity:**

| Metric       | loadfile      | load          | loadscope     |
| ------------ | ------------- | ------------- | ------------- |
| Wall clock   | 13.0m         | 13.6m         | **13.2m**     |
| T1 avg / max | 11.2m / 11.7m | 12.3m / 12.6m | 11.5m / 11.8m |
| T2 avg / max | 9.5m / 10.2m  | 9.5m / 10.6m  | 9.3m / 10.0m  |
| T1 spread    | 73s           | 41s           | 38s           |
| T2 spread    | 74s           | 120s          | 106s          |
| Runner-min   | 218m          | 223m          | **216m**      |

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

|             | Avg    | Max        | Min    | Spread  |
| ----------- | ------ | ---------- | ------ | ------- |
| Tier 1 (5)  | 10m15s | 10m25s     | 10m04s | **21s** |
| Tier 2 (17) | 9m41s  | 11m08s     | 8m12s  | 176s    |
| Wall clock  | —      | **11m29s** | —      | —       |

**Our best (loadscope + file):**

|             | Avg   | Max        | Min   | Spread   |
| ----------- | ----- | ---------- | ----- | -------- |
| Tier 1 (5)  | 9m46s | 10m49s     | 8m16s | **153s** |
| Tier 2 (17) | 9m53s | 10m41s     | 8m28s | 133s     |
| Wall clock  | —     | **11m56s** | —     | —        |

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

|             | Avg    | Max         | Spread |
| ----------- | ------ | ----------- | ------ |
| Tier 1 (7)  | 10m33s | 11m20s      | 134s   |
| Tier 2 (15) | 9m55s  | 11m00s      | 134s   |
| Wall clock  | —      | **~11m40s** | —      |

**Key takeaways for our clean branch:**

1. **Shard balance is the #1 remaining lever.** The baseline's 21s T1 spread vs our 153s accounts for most of the wall-clock gap. Per-test hash sharding or sorted round-robin would close this.
2. **Three-tier split** saves tier2 startup time by skipping heavy images for the majority of tier2 shards.
3. **Reclassification** (runtime-only Snuba detection) can move ~1,800 more tests to tier1, reducing T2 load.
4. **Shard count tuning** (6T1/16T2 or 7T1/15T2) better matches the actual workload distribution.

---

## Experiment: scope sharding (`TEST_GROUP_STRATEGY: scope`)

**Hypothesis:** Per-test hash sharding (`roundrobin`) scatters tests from the same class across shards, causing redundant module imports and class fixture setup. Switching to `scope` sharding (hash by `nodeid.rsplit("::", 1)[0]`, i.e. class-level) keeps entire classes on one shard, aligning with `--dist=loadscope` within shards.

**Config:** `TEST_GROUP_STRATEGY: scope` + `--dist=loadscope`, tested with class and test tier granularity.

**Results** (runs `22116057082`, `22116065056`, both passed):

| Metric       | scope+class       | scope+test       | Previous best (roundrobin+loadscope+file) |
| ------------ | ----------------- | ---------------- | ----------------------------------------- |
| Wall clock   | **21.0m**         | **19.5m**        | **11.9m**                                 |
| T1 avg / max | 10.5m / 11.5m     | 11.3m / 11.7m    | 9.8m / 10.8m                              |
| T2 avg / max | 10.1m / **20.4m** | 9.9m / **18.9m** | 9.9m / 10.7m                              |
| T2 spread    | **838s**          | **704s**         | 133s                                      |
| Runner-min   | 224m              | 225m             | 217m                                      |

**Root cause:** Scope sharding keeps entire classes on one shard. A few enormous classes (relay_integration, symbolicator, objectstore tests) create massive T2 hotspots — one shard took 20+ minutes while others finished in 6-7 minutes. The concentration of heavy tests on a single shard also caused resource exhaustion: too many tests hitting Postgres simultaneously led to `psycopg2.OperationalError: Connection refused` (port 5432) and Snuba gateway crashes, producing 50+ errors on the worst shards.

**Conclusion:** Scope sharding is not viable without first solving the heavy-class hotspot problem. Reverted to `roundrobin` + `--dist=loadfile` (baseline config).

---

## Step 5: Three-Tier Split with `backend-ci-light` (5T1 / 16T2 / 1T3)

**What:** Split tier2 into a light tier (Snuba/Kafka only) and a heavy tier (full stack). This avoids pulling and starting symbolicator, objectstore, and bigtable Docker images on 16 shards that don't need them.

**Tier layout:**

- **Tier 1** (5 shards): `migrations` mode — Postgres + Redis only. ~71% of tests.
- **Tier 2** (16 shards): `backend-ci-light` mode — Snuba + Postgres + Redis + redis-cluster. No heavy images. ~25% of tests.
- **Tier 3** (1 shard, `-n 2`): `backend-ci` mode — full stack with symbolicator, objectstore, bigtable. ~4% of tests.

**New devservices mode** (`devservices/config.yml`):

- Added `backend-ci-light: [snuba, postgres, redis, redis-cluster]` — skips bigtable, symbolicator, objectstore.
- Tier2 shards use `devservices up --mode backend-ci-light` instead of `backend-ci`.

**Tier3 routing** (`split-tests-by-tier.py`):

- `TIER3_SERVICES = {"symbolicator", "objectstore", "bigtable"}` — tests needing these go to tier3.
- `TIER3_PATH_PREFIXES = ("tests/relay_integration/",)` — relay tests routed to tier3 by path. Relay tests are individually slow (12-18s each) and cause shard imbalance if left in tier2.
- `FORCE_TIER3_FILES` — `test_preprod_artifact_snapshot.py` forced to tier3 (objectstore dependency missed by classifier).

**Other fixes:**

- Restored `--dist=loadfile` (was accidentally left as `--dist=load` from earlier experiment).
- All tiers use `TEST_GROUP_STRATEGY: roundrobin` + `PYTHONHASHSEED: '0'` (matching baseline).

**Expected improvement:** Tier2 startup should be faster since 16 shards skip pulling ~3 heavy Docker images. Tier3 absorbs the slow relay/symbolicator/objectstore tests onto a dedicated shard with the full stack.

**Results** (run `22120115422`, `--dist=loadscope`, no extra tests forced to tier3):

| Metric       | Step 4 best  | Step 5        |
| ------------ | ------------ | ------------- |
| Wall clock   | 11.9m        | **13.0m**     |
| T1 avg / max | 9.8m / 10.8m | 11.4m / 12.7m |
| T2 avg / max | 9.9m / 10.7m | 10.6m / 11.4m |
| T3           | —            | 8.1m          |
| T1 spread    | 153s         | 136s          |
| T2 spread    | 133s         | 88s           |
| Runner-min   | 217m         | 234m          |

Wall clock regressed from the earlier 11.8m (run `22118316595`, `--dist=loadfile`) to 13.0m. Investigation: the earlier 11.8m run used `--dist=loadfile` with the same tier layout and no extra forced tests. T1 spread was only 26s (vs 136s with `loadscope`). `loadscope` appears worse in the 3-tier config — T1 has fewer, larger test files where `loadfile`'s per-file fixture reuse is more valuable. The `loadscope` advantage seen in Step 4 (2-tier, 17 T2 shards) doesn't carry over to the 3-tier layout.

---

## Bug Fix: Kafka Per-Worker Topic Isolation

**What:** Fixed a correctness bug where Kafka topic isolation under xdist was completely non-functional. All xdist workers shared the same Kafka topics and consumer group, meaning Relay events from one worker could be consumed by another worker's test consumer, causing non-deterministic test pollution.

**Root cause:** The per-worker isolation required three coordinated pieces. `template/config.yml` was already correct on our branch (the Step 2 commit included `${KAFKA_TOPIC_EVENTS}` / `${KAFKA_TOPIC_OUTCOMES}` template variables), and `sentry.py`'s `_get_xdist_kafka_topic()` helper was fine. However, `kafka.py` — the consumer side — was never updated:

1. **`sentry.py`** — `_get_xdist_kafka_topic("ingest-events")` correctly computes per-worker topic names (e.g., `ingest-events-gw0`). Fine.
2. **`template/config.yml`** — Already had `${KAFKA_TOPIC_EVENTS}` / `${KAFKA_TOPIC_OUTCOMES}` from Step 2, so Relay containers write to per-worker topics correctly. Fine.
3. **`kafka.py`** — Had **hardcoded** `"ingest-events"`, `"outcomes"`, and `group_id = "test-consumer"` instead of using `_get_xdist_kafka_topic()`. All workers' consumers subscribed to the same topic with the same group ID.

**Net effect:** Relay was writing to per-worker topics (e.g., `ingest-events-gw0`) but consumers were reading from the shared `ingest-events` topic. Events written by Relay were never consumed, and the consumers saw nothing (or stale data from a previous run).

**Fix (ported from golden branch):**

- `kafka.py`: Added `from sentry.testutils.pytest.sentry import _get_xdist_kafka_topic`, replaced all hardcoded topic names and the consumer group ID with `_get_xdist_kafka_topic(...)` calls.

**Impact:** Currently masked because relay tests run on tier3 with only 1 shard and 2 xdist workers, limiting the blast radius. Would cause increasingly flaky failures as shard count or worker count scales up. Fixing this is a prerequisite for reliable parallel relay test execution.

---

## Experiment: G1 (direct file collection) and Balanced Sharding (LPT)

Two optimization experiments run in parallel worktrees on top of the Step 5 + Kafka fix baseline. All three runs used `--dist=loadscope`, no extra tests forced to tier3, and the Kafka isolation fix.

### G1: `pytest_ignore_collect` hook

**What:** Added a `pytest_ignore_collect` hook that reads `SELECTED_TESTS_FILE` and skips importing test files not in the tier's test list. Normally pytest imports every `.py` file under `tests/` during collection even if the file will be deselected later. With G1, irrelevant files are skipped before import, reducing collection time from ~105s to ~55s per shard.

**Service-readiness gate:** Because collection finishes faster with G1, tests can start executing before background `devservices up` completes (H1 overlap). A session-scoped autouse fixture `_wait_for_services` blocks until a sentinel file (`/tmp/services-ready`) exists, created by the startup script after all services are healthy. This preserves the collection/startup overlap while preventing race conditions.

**Results** (run `22120115559`, 0 failures):

| Metric       | Step 5 (main) | G1            | Delta     |
| ------------ | ------------- | ------------- | --------- |
| Wall clock   | 13.0m         | **11.2m**     | **-1.8m** |
| T1 avg / max | 11.4m / 12.7m | 10.5m / 10.9m | -1.8m max |
| T2 avg / max | 10.6m / 11.4m | 9.6m / 10.6m  | -0.8m max |
| T3           | 8.1m          | 8.4m          | +0.3m     |
| T1 spread    | 136s          | **51s**       | -85s      |
| T2 spread    | 88s           | 95s           | +7s       |
| Runner-min   | 234m          | **215m**      | **-19m**  |

**Analysis:** G1 delivers the biggest single improvement since H1 (overlapped startup). The 50s collection savings per shard directly reduces wall clock since T1 doesn't have devservices startup to overlap with — the time comes straight off T1 durations. T1 spread dropped to 51s (from 136s), making it remarkably well-balanced. T1 is still the critical path (10.9m) but now only barely above T2 max (10.6m).

### Balanced Sharding: LPT (Longest Processing Time) bin packing

**What:** Duration-based test assignment using greedy bin packing (LPT algorithm). Each test is assigned to the shard with the lowest cumulative load, using historical per-test durations from a cached JSON file. Extracts only `call` phase durations to avoid H1 setup contamination. Caps any single test at 60s. Falls back to hash-based sharding on the seed run (no prior data).

**Results** (run `22120116013`, 0 failures, **seed run — no prior duration data**):

| Metric       | Step 5 (main) | Balanced (seed) | Delta     |
| ------------ | ------------- | --------------- | --------- |
| Wall clock   | 13.0m         | **12.6m**       | **-0.4m** |
| T1 avg / max | 11.4m / 12.7m | 10.9m / 12.1m   | -0.6m max |
| T2 avg / max | 10.6m / 11.4m | 10.6m / 11.7m   | +0.3m max |
| T3           | 8.1m          | 8.6m            | +0.5m     |
| T1 spread    | 136s          | 167s            | +31s      |
| T2 spread    | 88s           | 99s             | +11s      |
| Runner-min   | 234m          | **232m**        | **-2m**   |

**Analysis:** This was a seed run (no cached durations), so LPT fell back to hash-based sharding — essentially the same as roundrobin. The small improvement is noise. The real LPT benefit should appear on the next run, which will use the durations cached from this run. A follow-up run is needed to evaluate actual LPT performance.

### Summary

| Config          | Wall clock | Runner-min | T1 spread | Failures |
| --------------- | ---------- | ---------- | --------- | -------- |
| Main (Step 5)   | 13.0m      | 234m       | 136s      | 0        |
| **G1**          | **11.2m**  | **215m**   | **51s**   | 0        |
| Balanced (seed) | 12.6m      | 232m       | 167s      | 0        |

G1 is the clear winner. Collection-time savings are the largest remaining lever after H1. Balanced sharding needs a follow-up run with cached durations to show its potential — ideally combined with G1.

### Reverting to 2-Tier Layout

3-tier (5T1/16T2/1T3) did not save runner-minutes vs 2-tier (5T1/17T2). Reverting to 2-tier with `--dist=loadfile`.

**Why 3-tier didn't help:** The theory was that `backend-ci-light` on T2 would skip heavy images (relay, symbolicator, objectstore) and save startup time per shard. In practice: (1) Snuba/Clickhouse/Kafka/Postgres are the heavy images and are needed in both modes — relay/symbolicator/objectstore add only ~5-10s marginal startup. (2) Startup overlaps with test collection (H1 optimization), so the extra seconds are hidden. (3) The extra T3 shard running full `backend-ci` for ~8m ate any marginal T2 savings. Net result: ~234m runner-minutes for both layouts.

**2-tier confirmed results** (run `22121660458` main, `22121660683` G1, 0 failures):

| Config        | Wall clock | Runner-min | T1 max | T2 max |
| ------------- | ---------- | ---------- | ------ | ------ |
| Main 2-tier   | 11.7m      | 234m       | 11m40s | 11m21s |
| **G1 2-tier** | **10.8m**  | **214m**   | 10m49s | 10m36s |

G1's `pytest_ignore_collect` saves ~50s per shard by skipping irrelevant file imports, directly reducing both wall-clock and runner-minutes. This is the only optimization that meaningfully reduces runner-minutes (234m → 214m).

### LPT Second Run Analysis — Why Flat LPT Wrecks Intra-Shard Parallelism

**Run** `22120525740` (second balanced run, cached durations from seed run).

LPT was active with 13,372 tests of timing data. All 16 T2 shards predicted exactly `1077s` total duration with `spread: 0s` — mathematically perfect balance. Yet actual wall-clocks ranged from **568s to 857s**, a 289s spread:

| Shard  | Scopes assigned | Predicted total | Actual wall-clock |
| ------ | --------------- | --------------- | ----------------- |
| T2(0)  | 67 (heavy)      | 1077s           | **819s**          |
| T2(1)  | 77              | 1077s           | **857s**          |
| T2(11) | 95 (light)      | 1077s           | **568s**          |

**Root cause:** LPT optimises **total duration per shard**, but each shard runs N=3 xdist workers in parallel. Actual wall-clock = `max(worker_loads)`, not `sum(worker_loads)`. By assigning the heaviest scopes to the lightest bin, LPT concentrated heavy scopes together: shard 0 got 67 large scopes, shard 11 got 95 small ones. Both sum to ~1077s, but shard 0's workers are severely imbalanced (one worker gets stuck on a 60s scope while others idle), giving ~1.3x parallelism. Shard 11's many small scopes spread evenly, giving ~1.9x parallelism.

### Fix: Worker-Simulated LPT

Instead of tracking one number per shard (total duration), track the load on **each of the N workers** inside each shard. When placing a scope, simulate: "if I add this scope, it goes to the lightest worker — what would the resulting max-worker-time (wall-clock) be?" Assign to the shard that minimises the global maximum wall-clock.

Algorithm:

1. Sort scopes by duration descending (heaviest first, same as before).
2. For each scope, for each candidate shard:
   - Find the lightest worker in that shard.
   - Compute `predicted_wallclock = max(worker_loads after adding scope to lightest worker)`.
3. Assign the scope to the shard with the lowest `predicted_wallclock`.
4. Update that shard's worker loads.

Complexity: O(scopes × shards × workers) = ~1460 × 17 × 3 ≈ 74K ops. Trivial.

This directly optimises the metric that determines actual run time, rather than a proxy (total duration) that ignores intra-shard parallelism.

### G1 Impact Summary

G1 (`pytest_ignore_collect`) is the single largest improvement after H1. It prevents pytest from importing test files that aren't in the shard's tier list, saving ~50s of module import time per shard. Without G1, every shard imports ALL ~1500 test files, discovers every test, then filters down — wasting ~1m45s on collection. G1 short-circuits this before the import step.

**2-tier confirmed results** (0 failures):

- Main: 11.7m wall clock, 234m runner-min
- G1: **10.8m wall clock, 214m runner-min** (best so far)

G1 is the only optimization that meaningfully reduces runner-minutes (234m → 214m = 20m saved), because it cuts actual work on every shard rather than just reshuffling it.

**Future collection-time ideas:**

- Skip entire directory subtrees (e.g., T1 shards skip `tests/snuba/`) to avoid even traversing them.
- Lazy imports in conftest files — pytest still imports every `conftest.py` in the tree even with G1; heavy top-level imports there cost time on every shard.
- Cache `__pycache__` across CI runs to avoid recompiling .py → .pyc on every shard.

---

## Experiment: Balanced Sharding with Hybrid LPT + Swap Refinement (⚠️ likely highly flawed study)

> **Caveat:** This experiment is likely highly flawed. The balanced branch diverged from main on multiple axes simultaneously (LPT algorithm, `--dist=loadscope`, `TEST_GROUP_STRATEGY=duration`, swap refinement), making it impossible to isolate the effect of any single change. The collection time discrepancy (228s vs 66s on T1) was never fully explained, and the scope-keeping constraint was tested only under `loadscope` — not under `loadfile` where the cost of indivisible units differs. Treat these findings as directional, not definitive.

**What:** Extended Worker-Simulated LPT with a swap refinement phase (Proposal C). After the initial LPT assignment, iteratively try swapping scopes between the heaviest and lightest shards to reduce the global max wallclock. Also switched from `--dist=loadfile` to `--dist=loadscope` to allow finer-grained within-shard parallelism. Ported G1 optimizations to this branch.

**Results** (run `22168142508`, second run with cached durations, 0 failures):

| Metric       | Main + G1 (22168142281) | Balanced + G1 + Swap (22168142508) |
| ------------ | ----------------------- | ---------------------------------- |
| Wall clock   | **10m53s**              | 13m22s                             |
| T1 avg / max | 10m31s / 10m53s         | 13m09s / 13m22s                    |
| T2 avg / max | 9m46s / 10m25s          | 10m00s / 11m11s                    |
| T1 spread    | 50s                     | 39s                                |
| T2 spread    | **106s**                | 474s                               |
| Runner-min   | **218.7m**              | 236.0m                             |

**Balanced is 2m29s slower and costs 17 more runner-minutes. Both tiers are worse.**

### T1: Duration-based sharding is net negative

- **Collection 3.5× slower (228s vs 66s):** All 5 balanced T1 shards consistently took ~230s for collection vs ~65s on main. Both branches have identical G1 code and the same 1508-file tier list. The exact cause is unclear — likely a combination of `--dist=loadscope` overhead and `_duration_based_split` running on each xdist worker.
- **Unbalanced test counts:** LPT optimizes by call-duration, not test count. T1(0) got 4971 tests vs main's 3888 (28% more). Per-test overhead (setup/teardown) not captured in durations caused proportionally longer execution (723s vs 567s).
- **Net:** LPT saved 11s of spread (39s vs 50s) but added ~2.5 minutes of overhead.

### T2: Mega-scopes are indivisible under loadscope

- **474s spread vs main's 106s.** The swap algorithm performed **0 swaps** despite 50 rounds available.
- **Root cause:** With `--dist=loadscope`, entire test classes are atomic units. A class taking 834s dominates one shard's wallclock. Swapping it to another shard just moves the bottleneck — no swap produces improvement when the mega-scope IS the bottleneck.
- Main's hash-based (roundrobin) sharding avoids this by hashing individual test nodeids, naturally scattering mega-class tests across all 17 shards.

### Key takeaway

For this workload (~32K tests with skewed class sizes), randomized hash sharding outperforms duration-based LPT because: (1) indivisible mega-scopes create unavoidable hotspots under scope-preserving algorithms, (2) with 17+ shards the law of large numbers gives randomized distribution good-enough balance, and (3) the algorithmic overhead (collection, JSON parsing, LPT computation) negates any theoretical improvement. Main + G1 with roundrobin remains the best configuration at **10m53s / 218.7m**.

---

## Bug Fix: setup-sentry deletes venv pyc files

`setup-sentry/action.yml` runs `find . -type d -name __pycache__ -exec rm -rf {} +` from the repo root. `.venv/` lives inside the repo root, so this also deletes all compiled bytecode from the cached venv — immediately after `action-setup-venv` restored it from cache. Python must recompile every installed package on first import each run.

**Fix:** Exclude `.venv/` from the deletion:

```bash
find . -not -path './.venv/*' -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -not -path './.venv/*' -type f -name "*.pyc" -delete 2>/dev/null || true
```

---

## Optimization: Lazy plugin imports (selenium, kafka, relay)

`sentry.testutils.pytest` unconditionally loads 13 plugins on every shard. Three of them import heavy third-party libraries at module level that are never used on T1/T2 shards:

- `selenium.py` — `from selenium import webdriver` + 6 more selenium imports. Selenium is a 23MB package. All CI shards pass `--ignore tests/acceptance`, so selenium is never exercised.
- `kafka.py` — `from confluent_kafka import Consumer, Producer` + `AdminClient` at module level.
- `relay.py` — `from sentry.runner.commands.devservices import get_docker_client` (pulls in Docker SDK) + `ephemeral_port_reserve` + `requests`.

**Fix:** Move these imports inside the fixture/function bodies that use them. Python caches modules in `sys.modules`, so the first call pays the import cost and subsequent calls are O(1) dict lookups. Zero functional impact.
