# Changelog

## Unreleased

### Scheduling and public API

- Make count-balanced LPT (`--parallel-balance=count`) the default; `round-robin` remains an explicit opt-out. Scheduling is deterministic (weight, collection position, then worker index) and restores relative file order per worker.
- Add the public customization hooks `pytest_parallel_file_groups`, `pytest_parallel_file_weight` (first non-`None` result), and `pytest_parallel_shard_worker` (conflicting pins are rejected), plus the frozen `pytest_parallel.api.Shard` type. Invalid weights, group names, and pins raise `pytest.UsageError` before workers spawn.
- Add `--parallel-plan[=text|json]` to print the resolved plan without running tests or spawning workers. JSON mode writes one versioned document to stdout and leaves diagnostics on stderr.
- Start the heaviest worker first under `--ramp`; ramping still waits at most once per worker, after collection.

### Correctness and reliability

- Default to `forkserver` on Linux (fresh interpreter, like `spawn`) so parent-imported modules cannot mask worker collection mismatches. Explicit `fork` remains available with documented inherited-state semantics.
- Give each worker a distinct `--basetemp` under one run root, disable worker cacheproviders, strip cache-selection flags from worker arguments, and write per-worker log files. Only the controller writes JUnit XML. Ini `addopts`, `pyproject.toml`, and `PYTEST_ADDOPTS` are sanitized the same way, so workers do not reload cacheprovider, reopen the controller JUnit file, or share one basetemp or log file.
- Apply `pytest_parallel_file_groups` and `pytest_parallel_file_weight` only inside the conftest directory that defines them. A conftest `pytest_parallel_shard_worker` pins a shard only when that shard contains a file under its directory.
- Make global `-x`/`--maxfail` genuinely cooperative: workers stop starting tests, in-flight tests complete teardowns and reports during a bounded 5s drain, and unexecuted tests are not synthesized as crashes. SIGTERM now follows the same cleanup path as SIGINT.
- Guard the network only inside parallel workers; serial pytest keeps standard socket behavior. Local listeners (`None`/`""`/unspecified bind addresses, local hostname) work under the guard.
- Reject combining pytest-parallel distribution with xdist `-n`, run `--setup-plan` through the serial runner, report explicit worker-count caps, and fall back safely when a worker warning class cannot be constructed from its message.

### Compatibility and quality

- CI now covers Linux and macOS on Python 3.13/3.14, Linux start-method smoke tests, and a non-blocking pytest pre-release job. Windows remains untested and unsupported.
- Add an honest benchmark harness (`benchmarks/run_benchmarks.py`) and results in `docs/benchmarks.md`; misleading startup/memory metrics are not reported.

### Correctness and reliability (P0)
- Reconcile per-worker test accounting (`assigned`, `started`, `completed`, `failed`, `unreported`, `session_finish`) so premature worker exits (`os._exit(0)`, `os._exit(1)`, `SIGKILL`, `SIGSEGV`, `pytest.exit`) and truncated/malformed JSONL streams never produce false-success runs.
- Emit and replay full phase-aware `TestReport` objects (`setup`, `call`, `teardown`) via `pytest_report_to_serializable` / `pytest_report_from_serializable`, preserving `wasxfail`, `xfailed`, `xpassed`, strict `xpass`, setup skips, setup/teardown errors, captured stdout/stderr/log sections, and `--durations`.
- Replay reports, collection failures, and runtime warnings through standard controller hooks (`pytest_runtest_logstart`, `pytest_runtest_logreport`, `pytest_runtest_logfinish`, `pytest_collectreport`, `pytest_warning_recorded`) for JUnit XML and plugin compatibility without mutating private `terminalreporter.stats`.
- Honor parent collection failures, `--continue-on-collection-errors`, `--collect-only`, `session.shouldfail`, and `session.shouldstop` without overwriting `session.testsfailed`.
- Reconstruct worker arguments from `config.invocation_params` rather than `sys.argv`, verify worker recollection matches assigned node IDs, and reject unsupported in-memory execution/collection plugins and interactive modes (`--pdb`, `--trace`) with `pytest.UsageError`.
- Enforce global `-x` / `--maxfail` cooperatively across workers and clean up already-started workers if a subsequent worker fails to spawn.

### Scheduling, execution, and compatibility (P1)
- Prefer `os.process_cpu_count()` for `--jobs=auto` and cap worker count by the number of schedulable file groups.
- Add `--ramp=DURATION` (`s`, `m`, `h`) to stagger first-test execution across active workers after collection.
- Add `--parallel-balance=round-robin|count` for optional largest-processing-time-first (LPT) static file sharding by test count.
- Add `@pytest.mark.parallel_group(name, ...)` for cross-file worker affinity without mutating `item.nodeid`.
- Add `--parallel-start-method=auto|fork|spawn|forkserver` and forward uncaptured `-s` output and `COLUMNS`/`LINES` terminal dimensions.
