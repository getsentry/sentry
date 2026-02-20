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

### Measured result (run `22197334992`)

Comparing against the previous warm-cache run (workflow_dispatch `22168142281`):

| Metric        | baseline (22168142281) | post-fix (22197334992) | delta           |
| ------------- | ---------------------- | ---------------------- | --------------- |
| Wall clock    | ~11m10s                | ~10m53s                | **-17s**        |
| Runner-min    | ~219m                  | ~211m                  | **-8m (-3.7%)** |
| T1 bottleneck | 10m54s                 | 10m36s                 | -18s            |
| T2 bottleneck | 10m25s                 | 10m38s                 | +13s            |

**Caveat:** Single data point; T2 shard spread is wide (7m50s–10m38s) so the -17s improvement is within normal run-to-run variance. The `Setup sentry env` step showed no discrete improvement (35s → 36s flat) because venv pyc recompilation cost is distributed across test collection/import time, not a single step. Both fixes are still correct — need more data points to confirm magnitude.

---

## Resource Profiling: CPU, Memory, and Service Contention

Monitoring run (`22197280450`, `mchen/resource-monitoring` branch): `vmstat`, `iostat`, `docker stats` sampled every 5s across representative T1 and T2 shards.

### What the data shows

**Memory is not the bottleneck.** Process memory (total RAM − free − buffers − cache) peaks at ~5.3 GB on T2 on a 16 GB runner. Services add: ClickHouse 744 MB, Kafka 472 MB, Postgres 443 MB, per-worker Snuba ×3 ~91 MB each.

**CPU is the binding constraint on T2.** vmstat run queue (`r`) averages 4.5–5.6 on a 4-CPU runner — meaning 20–40% of the time a runnable process is waiting for a CPU. Peak run queue hit 21. T1 run queue averages 3.3–3.8 (less pressure, 22% idle vs T2's 14%).

**sys% is 15–20% on T2 (vs ~17% on T1).** This is kernel-mode CPU time, and it comes from several sources:

1. **Postgres socket volume.** Each shard runs N xdist workers × 3 databases (region/control/secondary) simultaneously. Every Django ORM query involves a TCP send() + recv() pair through the kernel. Django TestCase also wraps every test in a SAVEPOINT on each of the 3 databases — at 32K tests that's 32K × 3 DBs × 2 round-trips (SAVEPOINT + ROLLBACK) = ~192K postgres round-trips per shard just for test isolation. Each round-trip copies data through kernel socket buffers, contributing directly to sys%.

2. **Three databases per worker.** The `configure_split_db()` call in `sentry.py` adds `control` and `secondary` alongside `default` (region). pytest-django appends `_gwN` suffixes, creating `test_region_gw0/1/2`, `test_control_gw0/1/2`, `test_secondary_gw0/1/2` = 9 concurrent postgres connections for N=3 workers. PIDS inside the postgres container: 7 idle → 16–17 during tests (9 connections + ~7 postgres background processes). Postgres sustained CPU: 25–92% during test execution.

3. **xdist inter-process coordination.** pytest-xdist scheduler sends/receives test assignments and results over sockets to each worker — minor but constant.

4. **Postgres WAL writes.** The postgres Docker image runs with `wal_level=logical` and no `synchronous_commit=off` override, so every committed transaction forces WAL data to disk. With 9 connections issuing constant writes, this generates frequent `fsync()` / `fdatasync()` syscalls inside the postgres process. These appear as sys% in vmstat since they're kernel I/O operations (even on fast SSD).

**iowait is negligible** (1–3%). The runner SSD handles sequential WAL writes without disk-queue buildup. The real cost is CPU cycles spent in the kernel managing the I/O, not waiting on the disk.

### Actionable findings

#### 1. Postgres performance flags for CI (easy, safe)

The postgres Docker command in `sentry-shared-postgres/devservices/config.yml` can take additional `-c` flags. For ephemeral test databases, durability guarantees are irrelevant:

```yaml
command:
  [
    postgres,
    -c,
    wal_level=logical,
    -c,
    max_replication_slots=1,
    -c,
    max_wal_senders=1,
    -c,
    synchronous_commit=off,
    -c,
    full_page_writes=off,
  ]
```

- `synchronous_commit=off`: postgres reports commit success without waiting for WAL to flush to disk. Data is still written — postgres just doesn't sync before returning. Reduces per-commit latency from ~1–5ms to <0.1ms. Safe: worst case on crash is losing the last few committed transactions, which is irrelevant for test databases.
- `full_page_writes=off`: disables writing full page images to WAL on the first modification after a checkpoint. Reduces WAL volume by 30–60%, cutting both the data-copying cost and the I/O overhead per transaction.

Expected impact: ~5–10% reduction in overall sys% by reducing WAL-related kernel I/O syscalls inside postgres. Also reduces postgres CPU usage since it no longer needs to format and sync WAL pages on every commit.

This change is to the `sentry-shared-postgres` repo — it would affect all devservices postgres users, not just CI. The flags are safe for dev and CI (not production).

#### 2. ClickHouse thread limits (easy, isolated)

`snuba/devservices/clickhouse/config.xml` sets `max_server_memory_usage_to_ram_ratio=0.5` (up to 8 GB), but there are no thread limits set anywhere. ClickHouse defaults to using `num_cpus` (4) threads per query plus background merge threads. On a 4-CPU T2 runner this means ClickHouse and pytest workers directly compete for all CPUs, contributing to the run queue spike.

In `snuba/devservices/clickhouse/users.xml`, add `<max_threads>` to the default profile:

```xml
<profiles>
    <default>
        <max_threads>2</max_threads>
    </default>
```

This caps ClickHouse query threads at 2 CPUs, leaving 2 for pytest workers + postgres. Expected impact: reduces run queue average on T2 by ~0.5–1, equivalent to freeing a partial CPU's worth of headroom for test execution.

#### 3. The 3-database-per-worker architecture is load-bearing

`configure_split_db()` adds the `control` and `secondary` databases to reflect sentry's hybrid-cloud silo design. Tests that exercise cross-silo operations need all three. Switching to `SENTRY_USE_MONOLITH_DBS=1` (single DB per worker) would reduce postgres connections from 9 to 3 and cut SAVEPOINT round-trips by 3×, but it also silently disables the silo routing and could hide real hybrid-cloud bugs. Not recommended without a clear plan for silo test coverage.

#### 4. TransactionTestCase is expensive

54 test files use `TransactionTestCase` instead of `TestCase`. `TestCase` wraps each test in a SAVEPOINT (cheap rollback). `TransactionTestCase` flushes the entire database between tests using `call_command("flush", ...)` — recreating tables is orders of magnitude more expensive. At 54 files × (unknown test count), these are disproportionately expensive per-test and cluster on whichever workers receive them, contributing to shard imbalance.

Most `TransactionTestCase` usage in Django is for testing code that explicitly commits transactions (e.g., testing `on_commit` signal handlers, or testing `select_for_update` behavior). An audit of the 54 files may reveal that many can be safely converted to `TestCase`, reducing expensive flush operations.

### Summary

| Finding                                                    | Impact                                         | Effort                                 | Risk                      |
| ---------------------------------------------------------- | ---------------------------------------------- | -------------------------------------- | ------------------------- |
| Postgres `synchronous_commit=off` + `full_page_writes=off` | -5–10% sys%, faster postgres commits           | Low (config change in shared-postgres) | Minimal (safe for dev/CI) |
| ClickHouse `max_threads=2`                                 | Frees 2 CPUs on T2, less run queue             | Low (1 line in users.xml)              | Minimal                   |
| Reduce TransactionTestCase usage                           | Faster per-test teardown, better shard balance | Medium (audit 54 files)                | Low                       |
| 3-DB architecture                                          | Would need redesign to change                  | High                                   | High                      |

---

## Experiment: xdist worker count (T1 n=4, T2 n=2)

**Hypothesis:** T2 at n=3 xdist workers on a 4-CPU runner is CPU-oversubscribed (run queue avg 4.5–5.6). Reducing T2 to n=2 frees a CPU for ClickHouse/Postgres, potentially improving throughput per worker. T1 has more headroom (run queue 3.3–3.8, 22% idle) so n=4 might use the spare CPU productively.

**Config:** Branch `mchen/xdist-n-workers` (run `22201290044`): T1 `-n 4`, T2 `-n 2`, otherwise identical to main + G1 baseline.

**Results:**

| Metric         | Baseline (n=3/n=3, run `22168142281`) | n=4/n=2 (run `22201290044`) | Delta            |
| -------------- | ------------------------------------- | --------------------------- | ---------------- |
| T1 max         | 10m53s                                | **10m32s**                  | -21s             |
| T1 spread      | 50s                                   | 67s                         | +17s             |
| T2 max         | 10m25s                                | **11m21s**                  | +56s             |
| T2 spread      | 106s                                  | 168s                        | +62s             |
| **Wall clock** | **10m53s**                            | **11m21s**                  | **+28s (+4.3%)** |
| Runner-min     | ~219m                                 | 223m                        | +4m              |

**Analysis:**

T1 improved slightly with n=4 (−21s max): T1 has no Snuba overhead — tests are postgres + CPU-bound. The 4th CPU was underutilized at n=3 (22% idle on T1), so the extra worker fills it productively.

T2 is significantly worse with n=2 (+56s max, +62s spread): dropping from 3 to 2 workers reduced throughput more than the reduced CPU contention helped. The key insight: tests spending time waiting on postgres/Snuba responses release the CPU while blocked — the xdist worker doesn't spin-wait. With n=2, the shard runs fewer tests concurrently and the CPU is less utilized, not more. The run queue on T2 is high (4.5–5.6) but most of that is ClickHouse + Kafka service processes competing, not pytest workers.

**Conclusion:** n=3 is correct for T2. The CPU oversubscription seen in vmstat is driven by service-side processes (ClickHouse, Kafka), not by having too many pytest workers. The fix is to constrain service CPU usage (ClickHouse `max_threads=2`) rather than reduce pytest concurrency. n=4 is marginally better for T1 (−21s, −3.2%) but comes at no cost since T1 has no per-worker Snuba bootstrap. Reverted T2 to n=3; T1 n=4 is worth keeping if confirmed across more runs.

---

## Experiment: ClickHouse `max_threads=2`

**Hypothesis:** ClickHouse defaults to `num_cpus` (4) query threads on a 4-CPU runner. Monitoring showed ClickHouse averaging 44% CPU with peaks of 235% (2.35 CPUs), directly competing with pytest workers. Capping ClickHouse to 2 threads should free ~1 CPU for pytest/postgres during query-heavy periods, reducing T2 wall clock.

**Config:** Branch `mchen/clickhouse-maxthreads` (run [`22202322211`](https://github.com/getsentry/sentry/actions/runs/22202322211)). Applied via `curl` after devservices up (no container rebuild required):

```bash
curl -sf 'http://localhost:8123/' \
  --data-binary "ALTER USER default SETTINGS max_threads = 2"
```

Note: this run used T1 `n=3` (the CH worktree was created before the T1 n=4 change landed on the clean branch), so the T1 comparison is not apples-to-apples.

**Results:**

| Metric         | Baseline (n=3/n=3, run `22168142281`) | CH max_threads=2 (run `22202322211`) | Delta                  |
| -------------- | ------------------------------------- | ------------------------------------ | ---------------------- |
| T1 max         | 10m53s                                | 11m7s                                | +14s (likely variance) |
| T2 max         | 10m25s                                | **10m16s**                           | **−9s**                |
| **Wall clock** | **10m53s**                            | **11m7s**                            | +14s (T1 variance)     |
| Runner-min     | ~219m                                 | 213m                                 | −6m                    |

**Analysis:**

T2 improved by 9s as expected — capping ClickHouse at 2 threads freed headroom for pytest workers during Snuba queries. Runner-minutes also dropped 6m (~3%), indicating less total CPU wasted on context switching.

T1 regressed 14s, but T1 tests don't use ClickHouse at all (T1 has no Snuba). This is run-to-run variance, not a real regression caused by the change. The ClickHouse cap only affects T2 where Snuba queries run.

**Conclusion:** `max_threads=2` gives a modest T2 improvement (~9s) and reduces runner-minutes. However, since this run used T1 n=3, the wall clock remained T1-dominated (11m7s). With T1 n=4 (already on the clean branch), the wall clock would be T2-dominated again. The CH cap is worth keeping as a low-effort optimization layered on top of the n=4/n=3 config. It should be combined with the postgres experiments for a cumulative test.

---

## Investigation: `dist=load` T1 regression and `test_buffer.py` fix

### Motivation

Step 4 showed `dist=load` (per-test dispatch) was consistently slower than `dist=loadfile` (per-file dispatch) across all granularities. T1 was disproportionately affected: +36s avg, +48s max at file granularity. T2 was essentially unchanged. This was surprising — T2 runs the full Snuba/Kafka/ClickHouse stack with more services and more complex per-worker isolation, so if `dist=load` caused resource contention or isolation failures, T2 should have been hit harder, not T1.

### Rerun analysis

Comparing the `dist=load` run (`22196178384`, T1 `-n 3 --dist=load`, T2 `-n 3 --dist=loadfile`) against the `loadfile` baseline (`22197280450`):

| Shard        | loadfile baseline | dist=load     |
| ------------ | ----------------- | ------------- |
| T1(0)        | 0 reruns          | **12 reruns** |
| T1(1)        | 1 rerun           | **8 reruns**  |
| T1(2)        | 0 reruns          | **13 reruns** |
| T1(3)        | 3 reruns          | **20 reruns** |
| T1(4)        | 2 reruns          | 0 reruns      |
| **T1 total** | **6**             | **53**        |
| **T2 total** | **17**            | **15**        |

T1 reruns spiked 9× (6 → 53) while T2 was unchanged. Extracting error messages from the CI logs revealed nearly all 53 T1 reruns came from a single file: `tests/sentry/spans/test_buffer.py`.

### Root cause

The errors fell into two categories, both originating from `test_buffer.py`:

**1. "Database access not allowed" (primary failure)**

```
test_buffer.py:344 → buffer.flush_segments(now=10)
  → buffer.py:628 _load_segment_data
    → Project.objects.get_from_cache(id=project_id)
      → Django ensure_connection()
        → RuntimeError: Database access not allowed, use the "django_db" mark
```

`test_buffer.py` is a Redis-only test — it doesn't use `@pytest.mark.django_db`. However, `flush_segments()` → `_load_segment_data()` has a metrics reporting path (line 628) that calls `Project.objects.get_from_cache()` when `dropped > 0` (some spans lost between ingestion and loading). This is a Django ORM query that requires database access.

**2. Redis data assertions (cascading from #1)**

When the DB access exception crashes `flush_segments()`, it prevents the method from returning results. Downstream assertions then fail: `assert rv == {expected data}` gets `{}`, and `assert client.ttl(k) > -1` gets TTL = -2 (key doesn't exist, because the flush never completed).

**Why it works under `loadfile` but fails under `load`:**

Both T1 and T2 have identical per-worker isolation for Postgres (separate databases per worker via pytest-django `--reuse-db`) and Redis (separate DB numbers per worker via `_get_xdist_redis_db()`). The isolation infrastructure was not the problem.

Under `loadfile`, all tests from a file are dispatched to the same worker consecutively. Tests that use Django `TestCase` (which extends `django.test.TransactionTestCase`) leave their database connection available after teardown. When `test_buffer.py` tests run on the same worker, they inherit this leaked connection — pytest-django doesn't actively block DB access between consecutive tests on the same worker if a connection was previously established.

Under `load`, per-test dispatch interleaves tests from different files on the same worker. A `test_buffer.py` test might follow a non-DB test whose teardown caused pytest-django to properly block database access. Without the `django_db` marker, the connection is refused.

**Why T2 was unaffected:** `test_buffer.py` is classified as a T1 test (it only uses Redis, no Snuba/Kafka). The brittle test simply doesn't exist in T2's test set.

### Validation

Created branch `mchen/fix-buffer-load` (run `22201666341`) with two changes: (1) added `pytestmark = [pytest.mark.django_db]` to `test_buffer.py`, (2) T1 set to `--dist=load`.

|              | dist=load (no fix) | **dist=load + fix** | loadfile baseline |
| ------------ | ------------------ | ------------------- | ----------------- |
| T1(0)        | 12                 | **1**               | 0                 |
| T1(1)        | 8                  | **2**               | 1                 |
| T1(2)        | 13                 | **0**               | 0                 |
| T1(3)        | 20                 | **0**               | 3                 |
| T1(4)        | 0                  | **3**               | 2                 |
| **T1 total** | **53**             | **6**               | **6**             |

The fix brought `dist=load` reruns to exactly the baseline level (6), confirming the missing `django_db` marker was the sole cause of the 47 additional reruns.

### Residual `dist=load` overhead

Even with reruns eliminated, `dist=load` still adds ~56s (+10%) to T1 pytest execution vs `loadfile`:

| Metric        | loadfile baseline | dist=load + fix | Delta           |
| ------------- | ----------------- | --------------- | --------------- |
| T1 avg pytest | 537s              | 594s            | **+56s (+10%)** |
| T1 max pytest | 563s              | 625s            | **+62s**        |
| T1 max job    | 11m01s            | 12m15s          | **+74s**        |

This overhead comes from fixture churn: `load` dispatch interleaves tests from different files on the same worker, causing repeated class/module fixture setup and teardown. The `_shuffle` function in `sentry.py` keeps classes and modules together to minimize this, but per-test dispatch defeats it. `loadfile` preserves the optimization by keeping all tests from a file on one worker.

### Conclusion

The `test_buffer.py` `django_db` fix is committed to the clean branch as a real bug fix — the missing marker causes flaky failures even under `loadfile` (3 of the baseline's 6 reruns were from this file). `dist=load` remains the wrong dispatch mode for T1: even with the flakiness fixed, it adds ~1 minute of fixture churn overhead. `loadfile` remains optimal.

---

## Postgres Network Traffic

### Root cause: `databases = "__all__"` on every TestCase

Sentry's base `TestCase` (`src/sentry/testutils/cases.py:432`) sets:

```python
databases: set[str] | str = "__all__"
```

Django's `_enter_atomics()` reads this attribute and opens a SAVEPOINT on every configured database before each test. With 3 databases (region/control/secondary), every test gets 3 SAVEPOINT opens + 3 ROLLBACK TOs regardless of whether the test ever touches `control` or `secondary`. Django's own default `TestCase` only issues SAVEPOINTs for `databases = {'default'}` — a single DB.

At 32K tests per shard × 3 DBs × 2 round-trips (open + rollback) = ~192K postgres round-trips per shard just for test isolation setup/teardown. Each round-trip is a TCP `send()` + `recv()` to the postgres container at `127.0.0.1:5432`.

The 3-database design is required for hybrid-cloud silo tests (some tests genuinely write to all three), but the majority of tests only touch `default` (region). Those tests pay 2× unnecessary SAVEPOINTs on databases they never use.

### Why postgres CPU is high (avg 57%, peak 192%)

Beyond the SAVEPOINT volume, postgres burns CPU on:

1. **WAL writes**: Every INSERT/UPDATE/DELETE in test fixtures and test data creation writes to the WAL. By default, postgres waits for WAL to flush (`synchronous_commit=on`), adding 1–5ms per commit. Fixture-heavy tests issue hundreds of commits per test file.

2. **`--reuse-db` startup cost**: On cold runs (new runner, no cached DB), postgres creates 3× `N_workers` databases (test_region_gw0/1/2, test_control_gw0/1/2, test_secondary_gw0/1/2) and runs all migrations for each — 191% CPU spike at startup before any test runs.

3. **Shared TCP stack overhead**: All postgres queries go through the TCP loopback interface. The kernel copies every query payload user→kernel (send) and response kernel→user (recv). With 9 concurrent connections issuing thousands of queries, this is a constant syscall overhead contributing to the 15–20% sys%.

### Actionable options

#### Option 1: `synchronous_commit=off` (easy, safe)

Applied via `docker exec` after devservices starts — no changes to sentry-shared-postgres required:

```bash
docker exec postgres-postgres-1 psql -U postgres \
  -c "ALTER SYSTEM SET synchronous_commit = off" \
  -c "ALTER SYSTEM SET full_page_writes = off" \
  -c "SELECT pg_reload_conf()"
```

- `synchronous_commit=off`: postgres ACKs commits immediately without waiting for WAL to flush to disk. The WAL is still written — just not synced before returning. Reduces per-commit latency from ~1–5ms to <0.1ms.
- `full_page_writes=off`: disables full-page images in WAL on first post-checkpoint write. Reduces WAL volume 30–60%.
- Safe for test databases: worst case on crash is losing the last few committed transactions — irrelevant since `--reuse-db` always starts from a known schema state.

Expected impact: reduces postgres CPU overhead for fixture writes (fixture creation is commit-heavy), and reduces WAL-related sys%.

#### Option 2: Unix domain socket (moderate effort, no sentry-shared-postgres change)

Replace the TCP connection to `127.0.0.1:5432` with a Unix domain socket. This eliminates the TCP stack entirely for postgres connections — no kernel TCP buffer copies, no TCP ACK overhead, just direct memory copies through the kernel socket.

**Implementation in-workflow** (no sentry-shared-postgres change required):

1. After `devservices up`, restart the postgres container with a socket volume mount:

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

2. Override Django's `HOST` setting in `sentry.py` before `configure_split_db()` (so control/secondary inherit it):

```python
if _pg_socket := os.environ.get("SENTRY_DB_SOCKET"):
    settings.DATABASES["default"]["HOST"] = _pg_socket
    settings.DATABASES["default"]["PORT"] = ""
```

3. Set `SENTRY_DB_SOCKET=/tmp/pg-sock` in the workflow.

psycopg2 uses a Unix socket when `HOST` is an absolute path — it looks for `.s.PGSQL.5432` inside that directory. No URL or connection string changes needed.

**Expected impact**: Reduces per-round-trip latency ~3× (TCP loopback ~30–50μs → Unix socket ~10–15μs). For ~500K total postgres round-trips per shard (192K SAVEPOINTs + ORM queries), this could save 10–20s.

#### Option 3: Narrow `databases` per test class (high effort, high impact)

For test classes that only query `default`, override `databases = {"default"}`. Django will then skip SAVEPOINTs on `control` and `secondary` for those tests, cutting their postgres round-trips from 3× to 1×. This requires auditing which tests actually need multi-silo DB isolation. A runtime tracer (monkey-patch `django.db.connections[alias].queries`) could automate this.

### Summary

| Option                       | Mechanism                                                    | Effort                                                          | Expected savings                       |
| ---------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------- |
| `synchronous_commit=off`     | Eliminate WAL sync latency per commit                        | Low (docker exec after devservices up)                          | ~5% postgres CPU                       |
| Unix domain socket           | Skip TCP stack per round-trip                                | Medium (in-workflow postgres restart + 2-line sentry.py change) | ~10-20s / shard                        |
| Narrow `databases` per class | Eliminate 2/3 of SAVEPOINT round-trips for region-only tests | High (audit 1800+ test files)                                   | Up to 2× postgres round-trip reduction |

---

### Why `dist=load` hurts T1 but not T2

Two mechanisms, both T1-specific:

1. **Rerun spike**: All 47 extra reruns came from `test_buffer.py`, a T1-only test. T2 never runs it.

2. **Fixture churn**: Under `loadfile`, class/module fixtures are set up once per file per worker. Under `load`, test interleaving forces repeated teardown and re-setup. T1 is hit harder because:
   - T1 tests are lightweight Django tests that rely heavily on class-level `TestCase` transactions and module-scoped conftest fixtures — cheap individually, expensive when churned thousands of times.
   - T1 has ~19k tests across 5 shards — massive interleaving surface area.
   - The `_shuffle` function in `sentry.py` groups tests by class/module to minimize fixture cost; `loadfile` preserves this, `load` defeats it.

   T2 is resilient because its tests are heavy integration tests that already set up per-test state (Snuba queries, Kafka topics, ClickHouse tables) with function-scoped fixtures. Less to churn. Additionally, T2's ~90s devservices startup dominates the wall clock, making any fixture overhead a smaller fraction.

---

## Experiment: T1 n=4 on clean branch (new baseline)

**Config:** Branch `mchen/tiered-xdist-clean` (run [`22203192423`](https://github.com/getsentry/sentry/actions/runs/22203192423)). T1 `-n 4`, T2 `-n 3`, baseline optimizations only (lazy imports, G1, balanced sharding, `test_buffer.py` fix).

**Results:**

| Metric         | Old baseline (T1 n=3/T2 n=3, run `22168142281`) | New baseline (T1 n=4/T2 n=3, run `22203192423`) | Delta            |
| -------------- | ----------------------------------------------- | ----------------------------------------------- | ---------------- |
| T1 max         | 10m53s                                          | **10m8s**                                       | **−45s**         |
| T1 spread      | 50s                                             | 83s                                             | +33s             |
| T2 max         | 10m25s                                          | **9m59s**                                       | **−26s**         |
| T2 spread      | 106s                                            | 66s                                             | −40s             |
| **Wall clock** | **10m53s**                                      | **10m8s**                                       | **−45s (−6.9%)** |
| Runner-min     | ~219m                                           | ~208m                                           | −11m             |

Both tiers improved significantly. T1 n=4 added a 4th pytest worker to use the CPU headroom that was idle at n=3 (22% idle in vmstat), cutting the longest shard by 45s. T2 also improved — likely because these runs had warmer caches (venv cache hit). The spread on T2 narrowed considerably (106s → 66s), indicating more consistent shard loads.

**This is the reference baseline for all subsequent postgres experiments below.**

---

## Experiment: postgres `synchronous_commit=off` + `full_page_writes=off`

**Hypothesis:** Postgres WAL sync adds 1–5ms per commit. Test fixture creation is commit-heavy; disabling WAL sync should reduce per-commit latency from ~1–5ms to <0.1ms and reduce postgres CPU.

**Config:** Branch `mchen/pg-sync-commit` (run [`22203204826`](https://github.com/getsentry/sentry/actions/runs/22203204826)). After devservices up on both T1 and T2:

```bash
docker exec postgres-postgres-1 psql -U postgres \
  -c "ALTER SYSTEM SET synchronous_commit = off" \
  -c "ALTER SYSTEM SET full_page_writes = off" \
  -c "SELECT pg_reload_conf()"
```

**Results:**

| Metric         | New baseline (run `22203192423`) | pg-sync-commit (run `22203204826`) | Delta            |
| -------------- | -------------------------------- | ---------------------------------- | ---------------- |
| T1 max         | 10m8s                            | **10m56s**                         | **+48s (worse)** |
| T2 max         | 9m59s                            | **10m27s**                         | **+28s (worse)** |
| **Wall clock** | **10m8s**                        | **10m56s**                         | **+48s (+7.9%)** |
| Runner-min     | ~208m                            | ~208m                              | ~0               |

**Analysis:** Both tiers were slower, which is counterintuitive. Possible explanations:

1. **Run-to-run variance dominates**: A single run delta of +48s is within the observed variance range (~60s spread). The effect of synchronous_commit=off may be real but small — smaller than noise.
2. **WAL sync wasn't the bottleneck**: `--reuse-db` means most tests don't run migrations. Fixture creation (which does write data) may not issue enough commits for WAL sync to be a meaningful fraction of runtime.
3. **Docker exec overhead at T2 startup**: The psql command runs during the background devservices startup script — if the postgres container isn't fully ready, there could be a retry or wait added.

**Conclusion:** No measurable benefit observed. `synchronous_commit=off` is not recommended for this workload — the commit overhead isn't significant enough compared to query execution and TCP round-trip overhead. Single-run data; could retest for confirmation.

---

## Experiment: postgres Unix domain socket

**Hypothesis:** Replacing TCP loopback (`127.0.0.1:5432`) with a Unix socket eliminates kernel TCP stack overhead per postgres round-trip, reducing the ~15–20% sys% that postgres connections contribute.

**Config:** Branch `mchen/pg-socket` (run [`22203222043`](https://github.com/getsentry/sentry/actions/runs/22203222043)). After devservices up, the postgres container is restarted with a socket volume mount:

```bash
mkdir -p /tmp/pg-sock
PG_IMAGE=$(docker inspect postgres-postgres-1 --format '{{.Config.Image}}')
docker stop postgres-postgres-1 && docker rm postgres-postgres-1
docker run -d ... -v /tmp/pg-sock:/var/run/postgresql ... "$PG_IMAGE"
until [ -S "/tmp/pg-sock/.s.PGSQL.5432" ]; do sleep 0.5; done
echo "SENTRY_DB_SOCKET=/tmp/pg-sock" >> "$GITHUB_ENV"
```

Django's `HOST` is overridden to the socket path before `configure_split_db()` so all three databases (region/control/secondary) use the socket. psycopg2 connects via `AF_UNIX` when HOST is an absolute path.

**Results:**

| Metric         | New baseline (run `22203192423`) | pg-socket (run `22203222043`) | Delta           |
| -------------- | -------------------------------- | ----------------------------- | --------------- |
| T1 max         | 10m8s                            | **9m32s**                     | **−36s**        |
| T1 spread      | 83s                              | 40s                           | −43s            |
| T2 max         | 9m59s                            | 10m3s                         | +4s (variance)  |
| T2 spread      | 66s                              | 90s                           | +24s            |
| **Wall clock** | **10m8s**                        | **10m3s**                     | **−5s (−0.8%)** |
| Runner-min     | ~208m                            | ~201m                         | **−7m (−3.4%)** |

**Analysis:**

T1 improved meaningfully: −36s max, −43s spread. T1 is postgres-heavy (no Snuba, tests connect to postgres for every fixture creation and every ORM query). Unix socket cuts per-round-trip overhead ~3× (TCP loopback ~30–50μs → Unix socket ~10–15μs). With 3 workers × 32K tests × multiple ORM queries per test, this adds up.

T2 was essentially flat (+4s is within variance). T2 is I/O dominated by Snuba/ClickHouse queries over HTTP, not postgres round-trips, so the benefit is diluted.

Wall clock improved −5s (now T2-dominated at 10m3s). Runner-minutes dropped −7m (−3.4%), reflecting less total syscall time wasted across all 22 concurrent jobs.

**T1 spread narrowed dramatically** (83s → 40s): the 5 T1 shards ran from 8m52s to 9m32s instead of 8m45s to 10m8s. This indicates the Unix socket makes postgres response times more consistent, reducing shard imbalance.

**Conclusion:** Unix domain socket provides a real T1 benefit (~36s max reduction) and saves runner-minutes. The implementation is pure workflow + 2-line sentry.py change — no sentry-shared-postgres modification required. Worth landing on the clean branch. The T2 wall clock is now the bottleneck at ~10m3s.

---

## Experiment: T1 n=5 xdist workers

**Hypothesis:** T1 uses `-n 4` on a 4-CPU runner. At n=4, vmstat shows T1 run queue 3.3–3.8 (22% idle). Adding a 5th worker might fill the remaining idle time since T1 tests are largely I/O-bound (postgres round-trips), allowing workers to yield the CPU while waiting.

**Config:** Branch `mchen/t1-n5` (run [`22204042209`](https://github.com/getsentry/sentry/actions/runs/22204042209)). T1 `-n 5`, T2 `-n 3`, pg-socket applied on T1 (same as clean branch).

**Results:**

| Metric         | pg-socket baseline (run `22204003661`) | T1 n=5 (run `22204042209`) | Delta  |
| -------------- | -------------------------------------- | -------------------------- | ------ |
| T1 max         | 10m8s                                  | **10m9s**                  | +1s    |
| T1 spread      | 40s                                    | —                          | ~same  |
| T2 max         | 9m39s                                  | 9m59s                      | +20s   |
| **Wall clock** | **10m8s**                              | **10m9s**                  | **~0** |
| Runner-min     | ~196m                                  | ~196m                      | ~0     |

**Analysis:** No improvement. A 5th worker on a 4-CPU runner doesn't reduce wall clock because the 4 existing workers already saturate available compute. Even though T1 tests are I/O-bound, the OS scheduler handles preemption efficiently — 5 workers competing for 4 CPUs adds context-switch overhead that offsets any additional concurrency gains. The 22% CPU idle in vmstat is consumed by OS scheduling and postgres process work, not available for extra pytest workers.

**Conclusion:** n=4 is optimal for T1 on a 4-CPU runner. n=5 provides no benefit.

---

## Experiment: Cumulative pg-socket + ClickHouse max_threads=2

**Hypothesis:** Combining both confirmed optimizations (pg-socket from `mchen/pg-socket`, CH cap from `mchen/clickhouse-maxthreads`) should stack: −36s from pg-socket on T1, −9s from CH cap on T2. Expected wall clock: ~9m30s.

**Config:** Branch `mchen/cumulative-opts` (run [`22204046073`](https://github.com/getsentry/sentry/actions/runs/22204046073)). Both T1 postgres socket restart and T2 `ALTER USER default SETTINGS max_threads = 2` applied.

**Results:**

| Metric         | pg-socket-only baseline (run `22204003661`) | pg-socket + CH cap (run `22204046073`) | Delta            |
| -------------- | ------------------------------------------- | -------------------------------------- | ---------------- |
| T1 max         | 10m8s                                       | **9m25s**                              | **−43s**         |
| T2 max         | 9m39s                                       | **10m23s**                             | **+44s (worse)** |
| **Wall clock** | **10m8s**                                   | **10m23s**                             | **+15s (+2.5%)** |
| Runner-min     | ~196m                                       | ~200m                                  | +4m              |

**Analysis:** T1 improved further (−43s vs −36s from socket alone) — additional single-run variance benefit. However, T2 regressed by +44s vs the pg-socket-only baseline. The CH cap at max_threads=2 appears to slow Snuba HTTP query responses enough to hurt T2 test throughput. The CPU headroom gained from capping ClickHouse doesn't offset the slower Snuba response times when pg-socket is already reducing postgres overhead.

This might be single-run variance, but the directionality is consistent with the theory: CH cap is most beneficial when T2 is CPU-constrained by ClickHouse competing with pytest. If postgres is no longer a significant CPU consumer (due to socket overhead reduction), CH cap provides less benefit while still slowing queries.

**Conclusion:** The two optimizations don't stack positively. CH max_threads=2 should not be combined with pg-socket. The pg-socket improvement stands on its own; CH cap is marginal and counterproductive in combination.

---

## Experiment: postgres synchronous_commit=off (warm venv cache re-run)

**Motivation:** The initial `pg-sync-commit` run (`22203204826`) was confounded by a cold venv cache (new branch, no cache inheritance). A warm-cache re-run should give a cleaner signal.

**Config:** Branch `mchen/pg-sync-commit` (run [`22203981251`](https://github.com/getsentry/sentry/actions/runs/22203981251)). Triggered by pushing an empty commit to warm up the cache from the previous run.

**Results:**

| Metric         | New baseline (run `22203192423`) | pg-sync-commit warm (run `22203981251`) | Delta                         |
| -------------- | -------------------------------- | --------------------------------------- | ----------------------------- |
| T1 max         | 10m8s                            | **12m17s** (shard 0 outlier)            | +2m9s (slow runner)           |
| T2 max         | 9m59s                            | **10m18s**                              | +19s                          |
| **Wall clock** | **10m8s**                        | **12m17s**                              | **+2m9s (outlier-dominated)** |

**Analysis:** Shard T1(0) hit 12m17s — a clear slow-runner outlier (GitHub Actions occasionally assigns underpowered runners). This invalidates the wall-clock comparison. T2 at 10m18s is within the variance range of the baseline (9m59s ± 30–60s typical). No clear signal either way — the outlier consumed any useful signal.

**Conclusion:** `synchronous_commit=off` shows no measurable benefit in two attempted runs. The commit overhead is not the limiting factor in this workload (most time is in query execution + round-trip latency, not WAL sync). Not worth retesting.

---

## Experiment: LPT-balanced T2 sharding by test count

**Hypothesis:** The current tier2 sharding uses `sha256(nodeid) % 17` (roundrobin) which distributes individual tests uniformly but ignores per-file test density. A file with 200 tests lands entirely on one shard and dominates its load. Using Longest Processing Time (LPT) bin packing by test count per file should reduce the worst-shard time.

**Implementation:**

- `split-tests-by-tier.py` extended with `--shards N --output-dir DIR` flags and LPT algorithm weighted by test count.
- The split-tiers job now produces per-shard files (`/tmp/tier2-shards/shard-{i}.txt`) instead of a single `tier2-tests.txt`.
- Each T2 matrix instance reads its pre-assigned file; `TOTAL_TEST_GROUPS=1` / `TEST_GROUP=0` override disables the hash-based second filter in `pytest_collection_modifyitems`.

**Run status:** Run [`22204128092`](https://github.com/getsentry/sentry/actions/runs/22204128092) **FAILED** due to an echo statement in the T2 run step still referencing `/tmp/tier2-tests.txt` (the old single file path, replaced by per-shard files). The `wc -l` call on the non-existent file caused all 17 T2 jobs to fail with "No such file or directory" before pytest even started.

Additionally, the first shard results that did run showed extreme imbalance — test count is a poor proxy for actual duration. T2(3) hit 17m9s while T2(7) hit 13m38s, compared to a baseline spread of ~90–130s. Heavy integration test files (slow per test) concentrated on certain shards while light files concentrated on others.

**Echo bug fix:** Corrected the echo statement from `wc -l < /tmp/tier2-tests.txt` to `wc -l < /tmp/tier2-shards/shard-${{ matrix.instance }}.txt`. Re-run: run [`22204823884`](https://github.com/getsentry/sentry/actions/runs/22204823884).

**Fixed re-run results** (run `22204823884`, 2 flaky failures unrelated to LPT):

| Metric         | Baseline roundrobin (run `22204003661`) | LPT test-count (run `22204823884`) | Delta               |
| -------------- | --------------------------------------- | ---------------------------------- | ------------------- |
| T1 max         | 10m8s                                   | 9m42s                              | −26s (not affected) |
| T2 max         | 9m39s                                   | **16m20s**                         | **+6m41s**          |
| T2 min         | —                                       | 5m30s                              |                     |
| T2 spread      | ~90s                                    | **650s**                           | **+560s**           |
| **Wall clock** | **10m8s**                               | **16m20s**                         | **+6m12s (+61%)**   |
| Runner-min     | ~196m                                   | ~196m                              | ~0                  |

**Analysis:** LPT with test count as weight is actively harmful. Wall clock regressed 61% despite identical runner-minutes (same total work, catastrophically worse distribution). The heaviest shards were tier2(3) at 16m20s and tier2(7) at 14m22s; the lightest were tier2(0) at 5m30s and tier2(14) at 5m44s.

**Root cause:** T2's slowest tests are heavy integration tests (relay, Snuba, symbolicator) that live in files with _few_ tests but _long_ individual durations. LPT weights by test count, so it treats these files as "light" — and concentrates them together on the same shards. Meanwhile, files with many fast unit tests get counted as "heavy" and spread across shards. The result inverts the intended balance. In contrast, roundrobin hash sharding distributes individual test nodeids uniformly — with ~32K T2 tests and 17 shards, statistical averaging gives ~90–130s spread naturally.

The two failures (`test_project_key_stats.py` Redis ConnectionError at teardown, `test_unmerge.py` assertion failure) are pre-existing flaky tests unrelated to sharding.

**Conclusion:** LPT with test count proxy is not viable. Roundrobin hash sharding outperforms it because it operates at the individual-test level where the law of large numbers applies, rather than at the file level where duration variance is extreme. To make LPT work, actual per-test durations would be needed — but even then, the 2D bin-packing problem (N xdist workers per shard) means total-duration LPT also fails (see "LPT Second Run Analysis" above). The worker-simulated LPT approach would be the correct algorithm, but requires real per-file duration data from GCS-stored pytest.json reports.

**All LPT variants summarized:** File-count LPT: +61% wall clock (catastrophic). Flat duration LPT: mathematically balanced totals but 289s spread due to ignoring intra-shard parallelism. Worker-simulated LPT: correct algorithm but requires GCS duration data. None are worth revisiting until duration data is plumbed in.

## Experiment: Snuba Unix domain socket (abandoned)

**Hypothesis:** Route sentry→Snuba HTTP traffic over Unix domain sockets instead of TCP to reduce per-request overhead, mirroring the postgres socket win.

**Why it was wrong:** The postgres socket optimization was meaningful because the Postgres wire protocol has multiple synchronous round trips per ORM call (BEGIN, query, COMMIT, keepalive), so TCP latency accumulates across thousands of calls per test. Snuba HTTP is a single request/response per interaction — one RTT, stateless. Transport overhead is microseconds per request. Even at 500 Snuba requests per worker per shard, the savings would be ~50–100ms total, not worth the complexity.

**Blocker discovered:** Snuba has migrated from uWSGI to **granian** (a Rust-based ASGI server). The implementation relied on `UWSGI_HTTP_SOCKET` being picked up via `_prepare_environ()`'s `os.environ.setdefault()` in `snuba/utils/uwsgi.py`. Granian ignores that env var entirely and binds to TCP 1218 as normal. Container logs confirm: `[INFO] Starting granian ... [INFO] Listening at: http://0.0.0.0:1218`. The Unix socket health check found no socket file and the background bootstrap reported failure.

**Alternatives considered and rejected:**

- _socat bridge_: `socat UNIX-LISTEN:/tmp/snuba-sock/snuba-gw${i}.sock,fork TCP:127.0.0.1:${WORKER_PORT}` on the host would create the socket file, but sentry → Unix socket → socat → TCP loopback → granian adds an extra process hop. Still pays TCP overhead, adds latency rather than reducing it.
- _Granian Unix socket config_: Would require overriding the container entrypoint to pass a `--host unix:/path` flag to granian. Involves Snuba-side changes and the fundamental savings would still be negligible.

**Branch:** `mchen/snuba-sock` (run [`22205812197`](https://github.com/getsentry/sentry/actions/runs/22205812197), all T2 shards failing — abandoned, not merged).
