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
