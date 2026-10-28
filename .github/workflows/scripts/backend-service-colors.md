# Backend service coloring (full backend test runs)

Full runs retain 30 jobs: shard 0 uses the existing `backend-ci` service
configuration; shards 1–29 use `backend-ci-general`, omitting Symbolicator.
Relay is started by pytest fixtures, not devservices. Other services are
unchanged. Selective PR runs keep the original dynamic shards and services.

## Requirements live with the tests

`pytest-selected.py` scans checked-in Python source before any test imports.
It recognizes `requires_symbolicator`, `RelayStoreHelper`, Relay pytest
fixtures (including `relay_setup_fixtures`), `request.getfixturevalue("...")`
with a Relay fixture name, and `pytest.mark.symbolicator`, using ASTs only
for files with hints.
This classifies the 11 existing Relay/Symbolicator-dependent test files without a
3,006-file committed allowlist or a second maintained JSON file.

When a test uses a processing service indirectly through another helper or
base class, annotate its test module with this one-line source pragma:

```python
# backend-ci: processing
```

New or renamed files are classified directly from their source. Processing
files remain whole on shard 0; general files retain the duration-weighted
planner and existing node-hash splitting across the other 29 shards.
Every test file is assigned; the planner never skips tests based on services.

After collection, a general shard fails if any selected test's resolved
fixture closure includes a Relay or Symbolicator fixture, including inherited/autouse
dependencies. The error instructs adding the module pragma. Arbitrary direct
service calls from unrelated helpers cannot be inferred automatically; such
files need the explicit pragma, and unmarked calls may fail at runtime.

As a last line of defense, the `relay_server` fixture itself refuses to start
a real Relay container on a general shard, raising an error naming the test.
This also catches dynamic `request.getfixturevalue(...)` requests that escape
static classification. Uncolored local and selective runs are unaffected.

## Safety checks

Colored runs reject wrong shard counts/colors, incompatible `-m`/`-k`,
missing duration data, and unsupported paths. No fallback to uncolored
hash sharding is permitted with Symbolicator missing. Selective PR testing
bypasses coloring entirely.

For each shard, the planner logs the shard index, service color, file count,
and Relay-dependent file count; after pytest it logs elapsed seconds. Each
Relay container startup is logged with the requesting test and shard color,
so general-shard startups can be audited from CI logs.

Generated `.artifacts/full-tests.shard-N.{txt,json}` files remain transient;
there is **no checked-in service classification manifest**.

## Validation

Planner and guard tests (no services):

```sh
.venv/bin/pytest -c .github/workflows/scripts/pytest.ini \
  .github/workflows/scripts/test_pytest_selected.py
```

For live verification, dispatch `backend.yml` or use the existing
`Trigger: Override Selective Testing` PR label. Confirm exact test/node
coverage, no new skips, and compare shard 0's elapsed time with general
shards. This is still a PoC: a wall-clock speedup has not been measured.
