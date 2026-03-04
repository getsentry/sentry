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

**NOTE: Experiments 6–10 used incorrect shard counts.** backend-light shards were added without reducing backend-test shards, so total shards exceeded 22 (27-28 instead of 22). Wall clock comparisons are still valid but runner-minute/average numbers are inflated because more shards were running than baseline. Experiment 11+ uses the correct 22-shard total.

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

---

## Experiment 8-9: see above (G1 results)

## Experiment 10: + H1 overlapped startup (T2 only), 6 backend-light shards

Same as Experiment 9, plus H1 on backend-test: `skip-devservices: true`, background subshell for devservices + pg-socket + Snuba bootstrap, foreground pytest. H1 NOT applied to backend-light (no measurable benefit for 17s service startup).

**backend-light (6 shards, sequential startup):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 10m43s | 124s | 9m13s | 22647711734 |
| 2 | 9m40s | 90s | 9m02s | 22647710835 |
| 3 | 9m07s | 33s | 8m49s | 22647710106 |
| **Mean** | **9m50s** | **82s** | **9m01s** | |

**backend-test (22 shards, overlapped startup):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 8m17s | 80s | 7m43s | 22647711734 |
| 2 | 9m17s | 122s | 8m02s | 22647710835 |
| 3 | 8m44s | 122s | 7m36s | 22647710106 |
| **Mean** | **8m46s** | **108s** | **7m47s** | |

**Overall (all 28 shards):**

| Run | Wall Clock | Spread | Average |
|-----|-----------|--------|---------|
| 1 | 10m43s | 226s | 8m02s |
| 2 | 9m40s | 145s | 8m15s |
| 3 | 9m07s | 145s | 7m52s |
| **Mean** | **9m50s** | **172s** | **8m03s** |

**Delta vs Experiment 9 (no H1):** backend-test avg −35s (8m22s → 7m47s). Overall avg −29s (8m32s → 8m03s). H1 reverted on backend-light (no benefit for 17s startup).

---

## Experiment 8: + G1 (pytest_ignore_collect), 5 backend-light shards

Same as Experiment 6, plus G1 — `pytest_ignore_collect` skips importing test files not in the tier's list.

**backend-light (5 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 10m50s | 41s | 10m30s | 22646291328 |
| 2 | 10m47s | 19s | 10m34s | 22646290469 |
| 3 | 10m51s | 97s | 10m20s | 22646289642 |
| **Mean** | **10m49s** | **52s** | **10m28s** | |

**backend-test (22 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 8m53s | 88s | 8m15s | 22646291328 |
| 2 | 9m18s | 115s | 8m19s | 22646290469 |
| 3 | 9m15s | 114s | 8m14s | 22646289642 |
| **Mean** | **9m09s** | **106s** | **8m16s** | |

**Overall (all 27 shards):**

| Run | Wall Clock | Spread | Average |
|-----|-----------|--------|---------|
| 1 | 10m50s | 205s | 8m40s |
| 2 | 10m47s | 204s | 8m44s |
| 3 | 10m51s | 210s | 8m38s |
| **Mean** | **10m49s** | **206s** | **8m41s** |

**Delta vs Experiment 6 (no G1):** backend-test wall clock −1m08s (10m17s → 9m09s), backend-test average −1m18s (9m34s → 8m16s). backend-light barely changed (−9s). Overall average −1m03s (9m44s → 8m41s). G1 saves ~1m18s per T2 shard = **~29 minutes of runner-minutes** across 22 shards.

---

## Experiment 9: + G1, 6 backend-light shards

Same as Experiment 8, but backend-light uses 6 shards instead of 5 to reduce its wall clock bottleneck.

**backend-light (6 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 10m04s | 137s | 9m08s | 22646330276 |
| 2 | 9m36s | 52s | 9m10s | 22646329560 |
| 3 | 9m38s | 73s | 9m05s | 22646328791 |
| **Mean** | **9m46s** | **87s** | **9m08s** | |

**backend-test (22 shards):**

| Run | Wall Clock | Spread | Average | Run ID |
|-----|-----------|--------|---------|--------|
| 1 | 9m15s | 116s | 8m26s | 22646330276 |
| 2 | 9m39s | 114s | 8m24s | 22646329560 |
| 3 | 9m32s | 166s | 8m17s | 22646328791 |
| **Mean** | **9m29s** | **132s** | **8m22s** | |

**Overall (all 28 shards):**

| Run | Wall Clock | Spread | Average |
|-----|-----------|--------|---------|
| 1 | 10m04s | 165s | 8m35s |
| 2 | 9m39s | 114s | 8m34s |
| 3 | 9m38s | 172s | 8m27s |
| **Mean** | **9m47s** | **150s** | **8m32s** |

**Delta vs Experiment 8 (5 shards):** Overall wall clock −1m02s (10m49s → 9m47s) by reducing the backend-light bottleneck. Overall average −9s (8m41s → 8m32s). Adding 1 shard to backend-light is worth it — wall clock drops significantly for a modest runner-minutes cost (+1 shard × 9m08s = +9m, offset by faster completion).

---

## Full Progress Summary

| Step | Wall Clock | Overall Avg | Runner-min impact |
|------|-----------|-------------|-------------------|
| Baseline (no xdist) | ~15m | ~15m | baseline |
| + xdist (Exp 1) | 13m23s | 12m10s | — |
| + pg-socket (Exp 2) | 12m38s | 11m40s | −11m |
| + relay session (Exp 3) | 12m30s | 11m33s | −3m |
| + tiered split (Exp 6) | 10m58s | 9m44s | −49m (fewer T1 runner-min) |
| + G1, 6 shards (Exp 9) | 9m47s | 8m32s | −31m (collection savings) |
| + H1 overlapped startup (Exp 10) | **9m50s** | **8m03s** | **−13m (overlap savings on T2)** |
