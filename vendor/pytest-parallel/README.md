# pytest-parallel

`pytest-parallel` runs pytest suites across fixed worker processes using static whole-file sharding. It requires Python 3.13+ and pytest 9+.

## Install

```bash
python -m pip install joshuarli-pytest-parallel
```

Pytest loads the plugin automatically after installation.

## Run tests

```bash
pytest
pytest -j 4
pytest --parallel-balance=round-robin
pytest --ramp=5s
pytest --parallel-start-method=spawn
pytest --parallel-plan
pytest --parallel-plan=json
pytest --parallel-network=inherit
pytest --parallel-drain=5s
pytest --parallel-collection=manifest
pytest --serial
```

Parallel execution is enabled by default:

- `-j`, `--jobs`: Worker count (`auto` by default). `auto` uses `os.process_cpu_count()` (falling back to `os.cpu_count()` or `1`), capped by the number of schedulable units and `pytest_parallel_max_workers()` (default `64`). An explicit request above the cap is reported, not silently reduced.
- `--parallel-balance=count|round-robin`: Sharding strategy. `count` (default) uses largest-processing-time-first (LPT) bin packing by estimated weight (test count unless customized). `round-robin` assigns units in collection order. Both preserve relative file order per worker and test order within each file. There is no global execution-order guarantee across workers.
- `--ramp=DURATION`: Stagger worker first-test start over a duration (e.g. `5s`, `1m`). The heaviest worker starts first; each worker waits at most once, after its own collection, and a stop request interrupts the wait. `--parallel-plan` never waits.
- `--parallel-start-method=auto|fork|spawn|forkserver`: Multiprocessing start method. `auto` selects `forkserver` on Linux and `spawn` elsewhere. `forkserver`/`spawn` start workers from a fresh interpreter, so parent-side imported test modules cannot mask worker collection differences. Explicit `fork` remains available on Linux, but it inherits parent process state (including already-imported modules and threads) and is rejected while non-main threads are alive; treat it as an opt-in for suites that understand those semantics.
- `--parallel-plan[=text|json]`: Print the resolved sharding plan (balance, workers, files, weights, groups, pinned vs automatic units, imbalance) and exit successfully without spawning workers or running tests. `json` writes one JSON document, `version` 1, to stdout and sends diagnostics to stderr. The document does not include the run id or collection seed. Text mode keeps the normal terminal report. Collection errors remain errors. It cannot be combined with `--serial`, `-j 0`, or `--collect-only`.
- `--parallel-network=loopback|inherit`: Network policy for parallel workers. `loopback` (default) blocks non-loopback socket use inside workers. `inherit` does not install that guard. Serial runs are never guarded. This guard is not an OS sandbox.
- `--parallel-drain=DURATION`: How long in-flight tests may finish after `-x` or `--maxfail` (default 5 seconds; for example `1s` or `0`). SIGINT and SIGTERM keep a 1-second drain. A worker that dies with no stop request is still a crash.
- `--parallel-collection=nodeid|manifest`: How a worker collects. `nodeid` (default) passes absolute assigned nodeids and requires the recollected list to equal the assignment. `manifest` passes the original directory or file arguments, so plugins configure before a nested conftest is imported. The manifest file is `worker_N_manifest.json` in the run directory, passed only as `PYTEST_PARALLEL_MANIFEST`.
- `--serial` (or `-j 0`): Run tests serially using pytest's standard runner.

Workers receive distinct per-worker `--basetemp` directories under one run-specific root (the explicitly configured `--basetemp`, with `worker-N` subdirectories, or a temporary run root when none is configured). The configured root itself is never a worker basetemp. Options inherited from ini `addopts` (pytest.ini, tox.ini, setup.cfg, or `pyproject.toml`) and `PYTEST_ADDOPTS` are placed on the worker command once, after coordinator flags (including `--parallel-drain` and `--parallel-collection`), cache-selection flags, JUnit XML, `--log-file`, `--basetemp`, `--rootdir`, and explicit `-p cacheprovider` / `-p pytest_cacheprovider` loads are removed. `--parallel-network` is forwarded. Each worker cacheprovider uses `cache_dir` `<basetemp>/pytest-cache`, so workers do not share `.pytest_cache` or redo `--lf`-style selection, which the parent collection already applied. `-p no:cacheprovider` is forwarded when cache is disabled. A configured log file, from `--log-file` or the ini `log_file` key, is written as one file per worker (`<name>.worker-N<ext>`). JUnit XML is produced once by the controller from replayed reports.

When you install `pytest-rerunfailures`, workers run its retries and the controller replays each attempt. A test counts as complete after its final attempt. When you also install `pytest-json-report` and pass `--json-report`, only the controller writes the JSON file. The controller receives worker report extras, including captured streams and metadata.

## Run identity

`pytest_parallel.api` provides frozen `RunInfo` and `WorkerInfo`, plus `current_run()` and `current_worker()`. Importing the module does not start a run or set an environment variable. A root `conftest.py` can read them at import time, including under the default `spawn` start method:

```python
from pytest_parallel.api import current_run, current_worker

run = current_run()
worker = current_worker()
```

`run.role` is `"controller"`, `"worker"`, or `"serial"`. `current_worker()` is `None` on the controller and under `--serial`; the controller is never worker 0. On a worker, `worker.index` is the scheduler bucket index (an empty bucket is not renumbered) and `worker.count` is the pool size after the schedulable-unit cap, including slots that were not spawned. `run.run_id` is `PYTEST_PARALLEL_RUN_ID` when that variable is already set; otherwise the controller creates one and workers inherit it. `run.collection_seed` is `PYTEST_PARALLEL_COLLECTION_SEED` when that variable is a base-10 integer, and `None` when the variable is absent.

## Inspect the plan

```bash
pytest -j 8 --parallel-plan
pytest -j 8 --parallel-plan=json
pytest --parallel-balance=round-robin --parallel-plan
```

`--parallel-plan=json` writes exactly one JSON document to stdout, followed by a newline. `version` is 1. Parse it with `json.loads` on the whole stdout. Diagnostics, including the pytest header and the collection report, are on stderr. Text mode is unchanged.

## File affinity groups

Whole test files run on a single worker by default. To assign multiple test files to the same worker, mark tests, classes, modules, or `pytest.param` entries with `@pytest.mark.parallel_group`:

```python
import pytest


@pytest.mark.parallel_group("database")
def test_migrations():
    ...
```

Files connected by a shared group name merge transitively into a single schedulable unit in collection order. Files are never split across workers. Affinity means co-location on one worker, not exclusion of other tests from that worker. Grouping never mutates node IDs, and parametrized IDs containing `::`, `@`, or Unicode are preserved.

Programmatic grouping from `conftest.py` (all implementations in scope contribute, additively with markers). A `conftest.py` hook applies only to files in its directory and below. Plugins loaded with `-p` or an entry point apply to every file. A nested `pytest_parallel_shard_worker` runs only for a shard that contains a file under that directory, and each implementation runs once:

```python
from pathlib import Path

import pytest


def pytest_parallel_file_groups(path: Path, items: list[pytest.Item]) -> list[str] | None:
    if "database" in path.parts:
        return ["database"]
    return None
```

`path` is relative to the rootdir when the file lives under it. Return `None` for no group. Empty or non-string names raise `pytest.UsageError`.

## Customize scheduling

All customization is ordinary pytest hook code in `conftest.py` or a plugin. No scheduler subclassing or configuration DSL is needed.

Custom estimated weights (first non-`None` result wins; use `tryfirst`/`trylast` to control priority among plugins). Weights are positive finite numbers, summed per affinity unit, and default to the file's test count:

```python
from pathlib import Path

import pytest


def pytest_parallel_file_weight(path: Path, items: list[pytest.Item]) -> float | None:
    if "browser" in path.parts:
        return len(items) * 10.0
    if "integration" in path.parts:
        return 50.0
    return None
```

Pin a whole unit to a worker. `Shard` is the frozen public view from `pytest_parallel.api` (`files`, `nodeids`, `weight`, `groups`, `ordinal`; paths follow the same rootdir-relative rule). All implementations are consulted: identical pins are fine, conflicting pins raise `pytest.UsageError`, and unpinned units are balanced automatically:

```python
from pytest_parallel.api import Shard


def pytest_parallel_shard_worker(shard: Shard, num_workers: int) -> int | None:
    if "gpu" in shard.groups:
        return 0
    return None
```

A complete example combining all three hooks lives in `conftest.py` at your project root; each hook is independent and optional.

Worker lifecycle hooks remain separate from scheduling:

```python
def pytest_parallel_max_workers() -> int | None:
    return 8


def pytest_parallel_pre_spawn(config, num_workers: int) -> None:
    ...


def pytest_parallel_worker_env(env: dict[str, str], worker_id: int) -> None:
    env["TEST_WORKER_ID"] = str(worker_id)
```

## Configure in pytest.ini / pyproject.toml

Use pytest's existing `addopts`; no new configuration language is introduced:

```ini
[pytest]
addopts = -j 8 --parallel-balance=count --ramp=2s
```

```toml
[tool.pytest.ini_options]
addopts = "-j 8 --parallel-balance=round-robin"
```

## Control network access

In parallel workers, with `--parallel-network=loopback` (the default), `pytest-parallel` blocks socket operations and hostname lookups outside loopback during each test. `--parallel-network=inherit` does not install the guard. Loopback, Unix sockets, binding to unspecified local addresses (`0.0.0.0`/`::` for `bind`), `getaddrinfo(None/"", ...)` for local listeners, and resolving the local hostname remain available. Connecting to `0.0.0.0` is not treated as loopback. A blocked operation raises `PermissionError`. Ordinary serial pytest (`--serial`, `-j 0`) is not guarded.

This guard is not an OS sandbox. It intercepts Python's `socket` API only. Native extensions and direct system calls bypass it; use an OS sandbox when you need a hard network boundary.

Mark a test with `@pytest.mark.enable_network` to allow network access for that test:

```python
import pytest


@pytest.mark.enable_network
def test_fetch_remote_data():
    ...
```

## Sentry integration

See [Sentry integration](docs/sentry-integration.md) for Sentry's optional runner path, worker resource slots, verification, and parked service checks.

## Compatibility

- Supported and CI-tested: Linux and macOS, Python 3.13 and 3.14, pytest 9. Windows is not currently tested or supported.
- Global `-x` and `--maxfail` stop workers cooperatively: no new tests start, in-flight tests finish their fixture teardowns and reports (bounded by `--parallel-drain`, default 5 seconds, then workers are terminated), and intentionally unexecuted tests are not reported as crashes. SIGINT and SIGTERM keep a 1-second drain. A crash with no stop request stays a crash.
- Uncaptured output (`-s`, `--capture=no`) is forwarded per test; captured stdout, stderr, and logs are preserved on test reports.
- Interactive debugging (`--pdb`, `--trace`) requires `--serial`. `--setup-plan` runs through the standard serial runner.
- In-memory execution or collection plugins passed to `pytest.main(plugins=[...])` are rejected in parallel mode; use `--serial` or register plugins by module name (`-p`).
- pytest-xdist may be installed, but `-n`/`--numprocesses` cannot be combined with pytest-parallel distribution; the combination raises `pytest.UsageError` (pass `--serial` to let xdist own the run).
- Third-party plugin output paths other than the core paths handled above (basetemp, log file, JUnit XML, cache) are forwarded unchanged; plugins that write shared files concurrently remain responsible for their own isolation.

See the [project repository](https://github.com/joshuarli/pytest-parallel) and [MIT license](LICENSE).
