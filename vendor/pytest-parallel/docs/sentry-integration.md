# Sentry integration

This page records Sentry's opt-in `pytest-parallel` path, its xdist compatibility points, the checks run, and the service checks that remain parked.

## Runner selection

Sentry keeps xdist as its default runner. Set `SENTRY_TEST_RUNNER=parallel` to select `pytest-parallel` through `.github/workflows/scripts/pytest-selected.py`. Set `SENTRY_TEST_RUNNER=serial` to run the same entry point serially. An unset value leaves the current xdist invocation unchanged.

For parallel runs, `pytest-selected.py` removes `-n`, `--numprocesses`, and `--dist` from `PYTEST_ADDOPTS`. It adds `-j`, manifest collection, and a 60-second cooperative drain. The worker count comes from `SENTRY_TEST_WORKERS`, then `XDIST_WORKERS`, then `2`. Sentry caps the pool at seven workers because the test Redis databases are 9 through 15.

## Identity and resource slots

`sentry.testutils.pytest.workers` reads the public `pytest_parallel.api` role. The controller and serial run have no worker index. A worker keeps the scheduler's bucket index.

| Role | Redis DB | Redis Cluster key prefix | Kafka topic and group suffix | Snuba URL | Snowflake ID |
| --- | ---: | --- | --- | --- | ---: |
| Controller or serial | 9 | `test-main:` | None | None | 0 |
| Worker `n` | `9 + n` | `test-gw{n}:` | `-gw{n}` | `127.0.0.1:1230+n` when `XDIST_PER_WORKER_SNUBA` is set | `n + 1` |

The test cell name uses the shared run ID. The xdist path keeps `PYTEST_XDIST_TESTRUNUID` as its seed. Sentry removes `DJANGO_SETTINGS_MODULE` and `PYTEST_XDIST_*` from each parallel worker environment so the worker configures Django after startup.

The controller acquires `.work/sentry-service.lock` before the first test Redis flush. A second controller fails if it cannot acquire the lock. Workers use their own default Redis database and a key-prefixed Redis Cluster client.

## Parent selection and reports

The parent applies `SELECTED_TESTS_FILE`, `TEST_GROUP`, `SENTRY_SHUFFLE_TESTS`, and `PYTEST_SHARD_PARTS`. Manifest workers receive the parent's ordered test identities. Sentry skips its selection and hash filters when `PYTEST_PARALLEL_MANIFEST` is set. Sentry also removes `PYTEST_SHARD_PARTS` from the worker environment.

Parallel workers use the default `--parallel-network=loopback` policy, which permits loopback sockets and Unix sockets. Mark tests that need external network access with `@pytest.mark.enable_network`. Serial runs are never guarded.

`pytest-parallel` replays every rerun attempt and marks an item complete after the final attempt. The controller writes JSON and JUnit reports. The plugin tests verify report extras and single-writer behavior with pytest-json-report 1.5.0 and pytest-rerunfailures 16.3. Sentry's `json_report_reruns.py` path has not been exercised by a real Sentry retry test.

## Xdist touchpoint ledger

| Touchpoint | Status | Verification |
| --- | --- | --- |
| Runner selection and xdist rollback | Done. xdist remains the default, and serial or parallel mode strips xdist distribution options. | `tests/sentry/testutils/test_runner_selection.py::test_addopts_parallel_strips_xdist_and_appends_jobs`, `::test_addopts_serial_strips_xdist_and_appends_serial`, `::test_addopts_xdist_unchanged` |
| Worker identity and resource slots | Done. The role API is available before conftest import. Native workers do not need `PYTEST_XDIST_WORKER`; controller and serial runs use the main slot. | PP-1 spawn tests; `tests/sentry/testutils/test_runner_selection.py::test_parallel_worker_index_0`, `::test_controller_uses_main_slot`, `::test_serial_uses_main_slot`, `::test_in_test_environment_parallel_worker_without_xdist` |
| Shared cell name and worker snowflakes | Done. Workers share the run-seeded cell name and receive distinct snowflake IDs. | `tests/sentry/testutils/test_runner_selection.py::test_parallel_run_shares_cell_name_and_worker_snowflakes`, `::test_cell_name_keeps_xdist_run_uid_fallback` |
| Database suffixes | Done for serial, native workers, and xdist worker IDs. The default, control, and secondary aliases keep their production `NAME` values. | `tests/sentry/testutils/test_runner_selection.py::test_effective_database_names_use_one_runner_suffix`, `::test_database_suffix_xdist_workerid` |
| Parent selection, hash split, shuffle order, and large-file parts | Done. Manifest workers keep the parent's order and do not reapply `PYTEST_SHARD_PARTS`. | `tests/sentry/testutils/test_manifest_selection.py::test_manifest_run_preserves_sentry_parent_subset_order`, `tests/sentry/testutils/test_runner_selection.py::test_worker_env_removes_parent_process_state_from_dict` |
| Empty CI shard and broken manifest | Done for the `pytest-selected.py` wrapper; manifest validation fails before tests run. | Existing `pytest-selected.py` tests and pytest-parallel manifest tests |
| JSON rerun history and one JUnit writer | Plugin behavior is verified. Sentry's reporter integration remains parked with SE-4. | Plugin `tests/test_reruns.py` and `tests/test_attempt_protocol.py`; no real Sentry retry run |
| Redis Cluster flush uses worker prefixes | Implemented. Teardown flushes the default Redis database and used key-prefixed cluster clients. Cross-worker isolation remains unverified. | `src/sentry/testutils/pytest/sentry.py::pytest_runtest_teardown`; the SE-3 canary below |
| Redis Cluster isolation canary | Parked. The local devservices stack has no Redis Cluster service. | The SE-3 two-worker canary failed because ports 7000 through 7005 refused connections. `devservices up` had already succeeded, so no second setup was attempted. |
| Snuba, Kafka, Redis Cluster, Relay, and acceptance smoke files | Parked with SE-4 because its SE-3 prerequisite is incomplete. | No SE-4 smoke command was run. |
| Sequential `--reuse-db` runs | Done. Serial and parallel SE-5 runs both used `--reuse-db`; database suffix tests also passed. | Sentry `.work/artifacts/commands.txt`, SE-5 serial and parallel commands; `test_effective_database_names_use_one_runner_suffix` |
| Backend shard stand-in | Done. `pytest-selected.py` ran 52 selected tests with two workers. Sorted nodeid and outcome entries matched the serial run. | Sentry `.work/artifacts/commands.txt`, SE-5 serial and parallel XML |
| Controller-only Selenium options and taskworker timeout guard | Done. Selenium skips controller-only options, and native workers skip signal-based timeout tests. | `tests/sentry/testutils/test_runner_selection.py::test_selenium_controller_options_skip_parallel_workers`; `PYTEST_ADDOPTS='' PYTHONPATH=src SENTRY_SKIP_SERVICE_VALIDATION=1 .venv/bin/pytest -q -j 1 tests/sentry/taskworker/test_timeout.py` (6 skipped) |

Run the focused Sentry checks from the Sentry checkout:

```bash
PYTEST_ADDOPTS='' PYTHONPATH=src .venv/bin/pytest --serial -q \
  tests/sentry/testutils/test_manifest_selection.py \
  tests/sentry/testutils/test_runner_selection.py
```

This command passed 25 tests. The service-backed SE-3 slice passed 52 tests serially and with one and two workers. The SE-5 `pytest-selected.py` run passed 52 tests with two workers, and its nodeid/outcome entries matched the fresh serial run. The Redis Cluster canary and SE-4 service smoke remain unverified.

## Compatibility details

`sentry.testutils.pytest.xdist` keeps its `PYTEST_XDIST_*` path for rollback runs. `workers.apply_database_suffix` uses pytest-django's private `_set_suffix_to_test_databases` helper because the parallel runner does not set xdist's `workerinput`. Remove that adapter only after the database suffix contract has a public pytest-django API or Sentry removes the xdist runner.
