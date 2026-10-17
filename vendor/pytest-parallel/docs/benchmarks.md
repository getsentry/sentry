# Benchmarks

## Methodology

Run:

```bash
uv run python benchmarks/run_benchmarks.py --trials 3 --workers 4
```

The harness builds four synthetic suites in a temporary directory (uniform files, one large file plus small files, many tiny files, one large parametrized file), then measures median wall time over repeated subprocess runs for:

- `--collect-only --serial` (parent collection only)
- serial execution
- parallel execution with `--parallel-balance=count`
- parallel execution with `--parallel-balance=round-robin`

It also times one `--parallel-plan=json` invocation per suite.

Measured quantities are total wall-clock times. Total parallel time includes parent collection, worker interpreter startup, worker recollection, test execution and report replay. The harness does **not** label `total - collection` as startup overhead, because that difference also contains test execution. Peak concurrent memory is not reported: `resource.getrusage(RUSAGE_CHILDREN).ru_maxrss` is a per-process maximum, not an aggregate concurrent peak, and no accurate cross-platform aggregate was available.

All runs succeeded (non-zero exits abort the harness). Work is verified by pytest's own pass accounting in each subprocess.

## Results (macOS, Python 3.14.7, pytest 9.0.3, 4 workers, median of 3)

| Suite | Collection only | Serial | Parallel count | Parallel round-robin |
| --- | ---: | ---: | ---: | ---: |
| uniform (8 files × 10 tests) | 0.458s | 0.598s | 0.996s | 0.777s |
| uneven (80 + 7×1 tests) | 0.279s | 0.311s | 0.831s | 1.225s |
| many_tiny (40 files × 1 test) | 0.329s | 0.327s | 0.658s | 0.747s |
| single_file (100 parametrized) | 0.252s | 0.370s | 0.758s | 0.717s |

## Interpretation and limitations

- These suites are tiny and CPU-trivial, so fixed worker startup and double collection dominate. Parallel execution is slower than serial here; that is expected and is not evidence about realistic suites with expensive tests.
- On the uneven suite, count-balanced LPT (0.83s) beat round-robin (1.23s) in this run, consistent with putting the 80-test file on its own worker. Three trials on one loaded developer machine is a directional signal, not a throughput guarantee.
- Count is a heuristic estimate of cost. It does not promise time-optimal scheduling; use `pytest_parallel_file_weight` when test count is a poor cost predictor.
- Ramp overhead, start-method comparison (fork vs forkserver vs spawn) and tail latency are measured by the integration tests for correctness; end-to-end start-method timing on Linux CI hardware is future work, as fork is unavailable as a fresh-interpreter default there by design (see README).
- No claim is made that count balancing improves throughput universally.
