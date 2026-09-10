# Local work profiling

Edit `setup_work()` in `profile_work.py`: arrange synthetic data outside the nested
`work()` function, then put the Python/Django code to measure inside it.

```python
def setup_work(case):
    from sentry.models.group import Group

    project = case.create_project()
    case.create_group(project=project)

    def work():
        count = Group.objects.filter(project=project).count()
        assert count == 1
        return count

    return work
```

The supplied `case` provides Sentry's test factories and a Django test client.
The callable can execute ORM queries, invoke a service or worker's processing
function directly, or call an endpoint with `case.client`. For example, replace
the setup and work blocks with:

```python
project = case.create_project()
case.login_as(user=case.user)

def work():
    response = case.client.get(
        f"/api/0/projects/{project.organization.slug}/{project.slug}/"
    )
    assert response.status_code == 200
    return response.json()["slug"]

return work
```

Evaluate lazy querysets inside `work()` so their SQL is measured. Assertions
inside `work()` validate each invocation and are included in wall time. Return
normalized JSON-compatible data to compare result hashes across runs, or return
`None` to skip that check. Normalize generated IDs and timestamps yourself;
matching hashes only compare what you chose to return.

## Run and compare

Run from the repository root with the virtualenv and local test services ready:

```bash
.venv/bin/python bin/perf/profile_work.py run \
  --output /tmp/before.json --warmups 2 --iterations 7 --reuse-db

# Edit the application code, then repeat with --output /tmp/after.json.
.venv/bin/python bin/perf/profile_work.py compare /tmp/before.json /tmp/after.json
```

The pytest driver initializes Sentry and isolated test databases, outside
measurement. The default recreates pytest databases;
`--reuse-db` preserves their schema, not fixture data. Neither mode targets the
devserver database. Do not run alongside tests sharing those databases.

Warmups and measured iterations repeat the callable without resetting state.
Design writes for repeated calls, and keep before/after fixture setup identical.
Use synthetic data only; do not add customer identifiers to the script. Reports
omit bound SQL parameters and result bodies. SQL text is opt-in with
`--include-sql` because it can contain sensitive literals. Labels are saved verbatim.

For an already-initialized test or Django context, the same file exposes
`profile_database_operation(work)` (returns the result and captured profile),
`run_profile(work, output=...)` (also saves a report), and the
`capture_database_queries()` context manager. `should_explain` can restrict
which captured SELECTs are replayed; return `False` to capture timings only.

## What is measured

- Wall time, Django cursor execution time, query counts, and SQL fingerprints.
- Separate PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` replays of selected SELECTs
  from the final iteration: plan work, indexes, buffer accesses, and spills.
- Medians, minima, and maxima across measured calls, not production p95 estimates.

Capture covers Django connections in the current thread. Remote RPC SQL,
other threads, and queued background workers are outside that scope. A remote
call that is awaited contributes to wall time, but its SQL is not visible.
Locally simulated RPC queries are captured in their recorded silo context;
tests may execute tasks inline, unlike production. Calling a worker's processing
function directly measures its local work, not queue delay or the full pipeline.
Endpoint calls through the test client are not network E2E measurements.

Cursor time excludes fetching. Remaining wall time includes fetching, validation,
instrumentation, and other I/O; it is not Python CPU time. Background work can
also affect real request latency indirectly through shared-resource contention,
which isolated local measurements do not reproduce.

Plan replays execute SQL in a rollback-only transaction/savepoint. Select only
queries without externally visible function side effects; CTEs and non-SELECTs
are skipped. `--statement-timeout-ms` applies to replays, not the original work.

`rows_processed` sums node outputs, potentially counting rows multiple times.
Buffer hits count accesses, not unique pages; shared reads may hit the OS cache.
Temporary writes measure scratch-file work, not persistent table growth.
Synthetic fixtures do not reproduce production churn, cache state, or concurrency.
Evaluate timings, plan work, spills, and correctness together—not a "perfect query"
score based only on whether an index is used.

## Tests

```bash
.venv/bin/pytest -n3 -q --reuse-db tests/performance
```

Ordinary tests skip the editable benchmark and cover profiling, report comparison,
and ORM and endpoint callables.
