# Benchmarks

## Methodology

- Metrics: **wall clock** (max shard duration from job start), **spread** (max − min shard duration), **average** shard duration
- Duration measured from job start (includes setup, bootstrap, test execution)
- Only the 22-shard `backend test` matrix is measured
- 3 concurrent runs to account for runner variance
- All runs use warm venv cache (second+ push to the same branch)

---

## Experiment 1: Mostly Unoptimized xdist

Branch `mchen/tiered-xdist-v2-clean`. Configuration:
- 22 shards, `-n 3 --dist=loadfile`, `PYTHONHASHSEED=0`
- Per-worker Snuba bootstrap (parallel)
- Per-worker Redis DB, Kafka topics, Relay containers, snowflake IDs
- `SENTRY_SKIP_SELENIUM_PLUGIN=1`
- No G1 (pytest_ignore_collect), no H1 (overlapped startup), no pg-socket, no tier split

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 13m42s | 212s | 12m12s | 22589935413 |
| 2 | 13m09s | 144s | 12m16s | 22589936538 |
| 3 | 13m19s | 186s | 12m02s | 22589937593 |
| **Mean** | **13m23s** | **181s** | **12m10s** | |

All 3 runs: 22/22 shards passed, 0 failures.

---

## Experiment 2: + Postgres Unix Socket

Same as Experiment 1, plus postgres container restarted with Unix domain socket volume mount. `SENTRY_DB_SOCKET=/tmp/pg-sock` set in workflow env.

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 12m19s | 88s | 11m40s | 22640074406 |
| 2 | 12m45s | 187s | 11m37s | 22640075476 |
| 3 | 12m50s | 143s | 11m42s | 22640076383 |
| **Mean** | **12m38s** | **139s** | **11m40s** | |

All 3 runs: 22/22 shards passed, 0 failures.

**Delta vs Experiment 1:** Wall clock −45s (13m23s → 12m38s), spread −42s (181s → 139s), average −30s (12m10s → 11m40s).

---

## Experiment 3: + Session-Scoped Relay Container

Same as Experiment 2, plus Relay container broadened from function-scoped (per test) to session-scoped (per worker). `_ensure_relay_in_db()` re-inserts Relay identity row before each test for TransactionTestCase compatibility.

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 12m10s | 88s | 11m33s | 22643161241 |
| 2 | 12m48s | 128s | 11m40s | 22643162159 |
| 3 | 12m33s | 158s | 11m26s | 22643163253 |
| **Mean** | **12m30s** | **125s** | **11m33s** | |

All 3 runs: 22/22 shards passed, 0 failures. (backend typing failed due to mypy — unrelated, fixed.)

**Delta vs Experiment 2:** Wall clock −8s (12m38s → 12m30s), spread −14s (139s → 125s), average −7s (11m40s → 11m33s). Marginal improvement — relay tests are only ~6 files, so the Docker lifecycle savings are small.

---

## Experiment 4: --dist=loadscope (vs loadfile baseline)

Same as Experiment 3, but with `--dist=loadscope` instead of `--dist=loadfile`.

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 12m31s | 169s | 11m16s | 22644095762 |
| 2 | 12m14s | 126s | 11m26s | 22644094691 |
| 3 | 12m21s | 141s | 11m26s | 22644093851 |
| **Mean** | **12m22s** | **145s** | **11m23s** | |

**Delta vs Experiment 3 (loadfile):** Wall clock −8s (12m30s → 12m22s), spread +20s (125s → 145s), average −10s (11m33s → 11m23s). Slightly faster wall clock/average but wider spread. Marginal difference.

---

## Experiment 5: --dist=load (vs loadfile baseline)

Same as Experiment 3, but with `--dist=load` instead of `--dist=loadfile`.

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 12m57s | 166s | 11m56s | 22644225590 |
| 2 | 12m50s | 181s | 11m52s | 22644224605 |
| 3 | 13m00s | 200s | 11m44s | 22644223781 |
| **Mean** | **12m56s** | **182s** | **11m51s** | |

**Delta vs Experiment 3 (loadfile):** Wall clock +26s (12m30s → 12m56s), spread +57s (125s → 182s), average +18s (11m33s → 11m51s). Worse on all metrics — per-test dispatch overhead outweighs utilization gains.

---

## Distribution Mode Summary

| Mode | Wall Clock | Spread | Average |
|------|-----------|--------|---------|
| loadfile | 12m30s | 125s | 11m33s |
| loadscope | **12m22s** | 145s | **11m23s** |
| load | 12m56s | 182s | 11m51s |

`loadscope` is marginally best on wall clock and average. `loadfile` has the tightest spread. `load` is worst across all metrics. Differences are small (~30s range). `loadfile` remains the safe default.

---

## Experiment 6: Tiered workflow — file granularity + loadfile

Split tests into backend-light (5 shards, postgres-only, `-n 4`) and backend-test (22 shards, tier2 only, `-n 3`). File granularity, `--dist=loadfile`.

**backend-light (5 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 10m54s | 59s | 10m20s | 22644945975 |
| 2 | 10m45s | 32s | 10m29s | 22644944902 |
| 3 | 11m15s | 117s | 10m27s | 22644943819 |
| **Mean** | **10m58s** | **69s** | **10m25s** | |

**backend-test (22 shards, tier2 only):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 10m17s | 74s | 9m36s | 22644945975 |
| 2 | 10m15s | 119s | 9m30s | 22644944902 |
| 3 | 10m18s | 105s | 9m37s | 22644943819 |
| **Mean** | **10m17s** | **99s** | **9m34s** | |

**Overall wall clock** (max of backend-light, backend-test): **10m58s**

**Delta vs Experiment 3 (no tiers):** Wall clock −1m32s (12m30s → 10m58s). backend-test dropped from 12m30s to 10m17s by removing tier1 tests.

---

## Experiment 7: Tiered workflow — class granularity + loadscope

Same tier split but with `--granularity class`, `--dist=loadscope`, `TIER_GRANULARITY=class`.

**backend-light (5 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 11m22s | 67s | 10m52s | 22645184111 |
| 2 | 12m03s | 48s | 11m27s | 22645183239 |
| 3 | 11m56s | 64s | 11m30s | 22645182310 |
| **Mean** | **11m47s** | **60s** | **11m16s** | |

**backend-test (22 shards, tier2 only):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 9m53s | 115s | 9m08s | 22645184111 |
| 2 | 10m25s | 166s | 9m18s | 22645183239 |
| 3 | 9m43s | 81s | 9m16s | 22645182310 |
| **Mean** | **10m00s** | **121s** | **9m14s** | |

**Overall wall clock**: **11m47s**

**Delta vs Experiment 6 (file+loadfile):** Overall +49s (10m58s → 11m47s). Class+loadscope helps backend-test (−17s) but hurts backend-light (+49s). backend-light is the bottleneck — file granularity is better for it.

---

## Tiered Summary

**Overall (all 27 shards: 5 backend-light + 22 backend-test):**

| Config | Wall Clock | Spread | Average | Delta vs no tiers |
|--------|-----------|--------|---------|-------------------|
| No tiers (Exp 3, 22 shards) | 12m30s | 125s | 11m33s | baseline |
| File + loadfile (Exp 6) | **10m58s** | **141s** | **9m44s** | **−1m32s** |
| Class + loadscope (Exp 7) | 11m47s | 227s | 9m43s | −43s |

File granularity + loadfile wins on wall clock. Class + loadscope has slightly better average but much worse spread (227s vs 141s) and worse wall clock due to backend-light being the bottleneck.
