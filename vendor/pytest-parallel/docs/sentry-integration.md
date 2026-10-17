# Sentry test runner

Sentry vendors pytest-parallel as regular source and documentation files. Pytest loads the plugin from `pyproject.toml`.

## Run tests in parallel

Parallel execution is the default, with an automatic worker count. Pass `-j N` to choose a count or `--serial` to use pytest's serial runner.

Sentry configures manifest collection and a 60-second cooperative drain for `-x` and `--maxfail`. The backend workflow uses two workers for pull requests and three for other events. The acceptance workflow uses two workers. Both read the count from `SENTRY_TEST_WORKERS`; Sentry caps it at seven workers to fit its Redis database slots.

## Control network access

Parallel workers block socket operations and hostname lookups outside loopback by default. Loopback addresses and Unix sockets remain available. Mark a test that needs external access with `enable_network`:

```python
import pytest


@pytest.mark.enable_network
def test_external_service():
    ...
```

Serial runs do not install the network guard.

## Isolate worker resources

Sentry uses `pytest_parallel.api` to identify the controller, serial process, and worker. Each worker keeps its scheduler index for resource names and database suffixes.

| Resource | Controller or serial process | Worker `n` |
| --- | --- | --- |
| Redis database | `9` | `9 + n` |
| Redis Cluster key prefix | `test-main:` | `test-gw{n}:` |
| Kafka topic and group suffix | None | `-gw{n}` |
| Snowflake ID | `0` | `n + 1` |
| Database suffix | None | `gw{n}` |
| Snuba URL | Default URL | `http://127.0.0.1:1230+n` when `SENTRY_TEST_PER_WORKER_SNUBA=1` |

The backend and acceptance workflows set `SENTRY_TEST_PER_WORKER_SNUBA=1` and bootstrap one Snuba instance per worker. The controller and serial process hold `.work/sentry-service.lock` while test service validation and Redis setup run.

Workers remove `DJANGO_SETTINGS_MODULE` so Django initializes in each worker. Manifest workers also skip Sentry's parent-only `PYTEST_SHARD_PARTS` filter. The parent applies selected-test, test-group, shuffle, and shard selection before it assigns tests.

## Reports

Workers send collection results, test reports, and warnings to the controller. The controller replays pytest's logging and collection hooks and writes the session's JUnit and JSON reports.

For pytest-parallel's scheduling, worker identity, and command-line options, see the [plugin README](../README.md). For benchmark methodology and its limits, see [benchmarks](benchmarks.md).
