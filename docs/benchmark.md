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
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
