# Local endpoint profiling

All tooling lives here, outside the Sentry runtime package. Run commands from the
repository root with the virtualenv and local test services available.

## Run and compare

```bash
.venv/bin/python bin/perf/profile-endpoint all-unresolved-issues \
  --output /tmp/before.json --param groups=10000 --param members=55 \
  --param assigned_percent=5 --param background_groups=100000 \
  --warmups 2 --iterations 7 --reuse-db

# Repeat the same command after editing the application, using /tmp/after.json.
.venv/bin/python bin/perf/compare-db-profiles /tmp/before.json /tmp/after.json

# A different endpoint, with the same runner:
.venv/bin/python bin/perf/profile-endpoint project-details \
  --output /tmp/project.json --reuse-db
```

The runner creates synthetic data in isolated pytest databases and calls the real
endpoint through the in-process API test client. This exercises request handling,
but is **not a network E2E test** against a running server. It does not model proxy,
worker scheduling, network latency, or production concurrency. Fixture setup is
outside measurement. Warmups and measured calls include workload response checks.

The default recreates pytest's databases; `--reuse-db` preserves their schema.
These are test databases, not the devserver's database. Do not run workloads
alongside tests sharing their databases or other CPU-intensive benchmarks.

Reports include wall/cursor timings, query counts and fingerprints, plan work,
buffer accesses, spills, and the effective workload parameters. SQL text is
opt-in with `--include-sql` because literals can contain sensitive data. Bound SQL
parameters and response bodies are not saved. Use synthetic workload parameters;
parameters and labels themselves are saved verbatim.
Reports also include a hash of the workload's normalized response snapshot. The
comparison command reports whether those hashes match without saving responses.

## Add a workload

Create a module in `perf_harness/workloads/`, or supply a trusted local
`module:factory` name. The factory receives an `EndpointContext` with Sentry's
test factories and API client, plus parameters supplied as `--param NAME=JSON`.
It returns a `Workload`; no runner changes are required. For example:

```python
from perf_harness.workload import Workload


def build_workload(case, parameters):
    if parameters:
        raise ValueError("This workload accepts no parameters")
    project = case.create_project(teams=[case.team])
    case.login_as(user=case.user)
    case.endpoint = "sentry-api-0-project-details"

    def validate(response):
        assert response.status_code == 200
        assert response.data["id"] == str(project.id)

    return Workload(
        operation=lambda: case.get_success_response(case.organization.slug, project.slug),
        validate=validate,
    )
```

`operation` may call any endpoint; the harness itself knows nothing about issues,
teams, or projects. Use `case.get_success_response(..., method="post", ...)` for
a write endpoint only with fixtures designed for repeated calls. The harness
does not reset application state between requests. `validate` checks every
response. `parameters` records effective fixture settings. `should_explain`
optionally selects which captured SELECTs to replay. `snapshot` defaults to
`response.data`; override it to normalize legitimately variable response fields.

Workloads may provide named `variants`, each a zero-argument context-manager
factory that temporarily applies an experiment and cleans it up. With
`--compare-variants`, each variant's responses must match a deep copy of the
baseline snapshot, and the baseline runs again at the end to expose timing drift.
Across separate before/after runs, response hashes are comparable when fixture
data and snapshot normalization are stable. Normalize generated IDs rather than
ignoring meaningful differences. The bundled issues workload orders projects by
fixture creation order and preserves the full per-project time series.

## Bundled issues workload

`all-unresolved-issues` accepts `groups` (10000), `members` (50), `projects` (3),
`assigned_percent` (100), `background_groups` (0), and `history_per_group` (2).
Background issues belong to another project but are assigned to the target
team's members. They must not change the result. The fixture is committed and
vacuumed before measurement, allowing index-only scans on all-visible pages.

This workload does not patch managers or add indexes. Query changes belong in
application code: save a baseline, edit the application, then rerun the same
workload and compare reports. `--compare-variants` only repeats the baseline for
this workload. Test multiple selectivities before choosing a query or index;
synthetic fixture sizes are not claims about production cardinalities.

## Interpretation and limits

- Timing summaries are medians, with minima and maxima. Small samples are not
  production p95 estimates.
- Cursor time excludes fetching. Remaining wall time also includes fetching,
  instrumentation, validation, and other I/O; it is not Python CPU time.
- Capture covers Django connections in the current thread. Remote RPCs,
  asynchronous workers, and other threads are not captured. Locally simulated
  RPC queries are captured and replayed in their recorded silo context.
- Plans are separate `EXPLAIN (ANALYZE, BUFFERS)` replays of the final request's
  selected SELECTs, not plans captured during those requests. Replays execute
  SQL and use a rollback-only transaction/savepoint. Do not select statements
  with externally visible function side effects. Non-SELECTs and CTEs are skipped.
- The statement timeout applies to plan replays, not the original endpoint call.
- `rows_processed` sums outputs across plan stages, counting some rows multiple
  times; it is not the number of distinct table rows scanned.
- Buffer hits count accesses, including repeated accesses to one block. Shared
  reads may be served from the OS cache. Temporary writes measure scratch-file
  work, not persistent table growth or necessarily physical disk writes.
- Vacuumed synthetic data does not model production churn or cold caches.
  Evaluate timings, work, spills, and correctness together, not a "perfect query"
  score based solely on whether an index is used.

## Tests

```bash
.venv/bin/pytest -n3 -q --reuse-db tests/performance
```

The CLI-selected workload is opt-in and skipped during ordinary test runs.
Unit tests and the small project-details integration test run normally.
