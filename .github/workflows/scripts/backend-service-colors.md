# Backend service coloring PoC

Full backend runs use the same 22 jobs, with one processing shard and 21 general
shards. The processing shard owns whole files that need live Relay or
Symbolicator. General shards use `backend-ci-general`, which omits Symbolicator
and keeps PostgreSQL, Redis, Snuba, Bigtable, Redis Cluster, and objectstore.
Relay was already absent from `backend-ci`; its pytest fixtures start it only
where needed.

This is the first service boundary. Snuba-only and PostgreSQL/Redis-only colors,
five-worker experiments, and fewer services on the processing shard need further
dependency audits. This PoC keeps the existing worker counts and per-worker
Snuba isolation.

## Shard mapping

| Full-run matrix index | Color        | Devservices mode     | Planning                                                  |
| --------------------- | ------------ | -------------------- | --------------------------------------------------------- |
| `0`                   | `processing` | `backend-ci`         | Whole processing files plus unknown files                 |
| `1` through `21`      | `general`    | `backend-ci-general` | Existing duration-weighted planner across these 21 shards |

`BACKEND_TEST_SERVICE_COLOR` is set only when the workflow runs the full suite.
Selective PR runs leave it empty and keep the existing selected-file planner and
full `backend-ci` service set. This preserves their dynamic shard count.

The role is selected before devservices starts. `pytest-selected.py` assigns the
files before pytest imports them; this does not use `-m` or `-k` filtering. A
colored run rejects incompatible filtering, a mismatched shard/color, a shard
count other than 22, or missing planning inputs instead of falling back to
collecting all files on a shard with fewer services.

## Processing inventory

`backend-test-service-colors.json` contains the explicit file inventory. The
initial processing bundle is:

- `tests/relay_integration/lang/java/test_plugin.py`
- `tests/relay_integration/lang/javascript/test_example.py`
- `tests/relay_integration/lang/javascript/test_plugin.py`
- `tests/relay_integration/test_integration.py`
- `tests/relay_integration/test_message_filters.py`
- `tests/relay_integration/test_sdk.py`
- `tests/symbolicator/test_minidump_full.py`
- `tests/symbolicator/test_payload_full.py`
- `tests/symbolicator/test_unreal_full.py`
- `tests/sentry/profiles/test_task.py`
- `tests/sentry/ingest/ingest_consumer/test_ingest_consumer_processing.py`

The audit includes `requires_symbolicator`, `relay_server`, `get_relay_*`, and
`RelayStoreHelper` users. In particular, `test_message_filters.py` obtains Relay
through the helper's autouse fixture. Unit tests that mock symbolication stay in
the general inventory. Objectstore remains available there because tests such as
`tests/sentry/lang/native/test_processing.py` use real objectstore while mocking
Symbolicator.

New files and renamed files absent from the manifest automatically go to the
processing shard, where the full service set is available. Audit their fixtures,
base classes, helpers, and direct service calls before adding them to `general`.
Do not regenerate the general list by treating every unlisted file as safe.
When an existing general file gains a live processing dependency, move its whole
file to `processing`. Deleted paths need not remain in the inventory.

The collection plugin rejects general-shard tests whose resolved fixture closure
includes `relay_server`, `relay_server_setup`, or `_requires_symbolicator`. This
catches inherited and indirect fixture dependencies without silently skipping
tests. Direct service calls still require an explicit inventory review.

The processing bundle is deliberately kept whole within one shard, so the old
cross-shard slicing no longer duplicates its Relay/Symbolicator fixture startup.
The current historical duration weights are a planning estimate, not an elapsed
time prediction. Unknown-file fallback can grow that shard; review its assigned
file list if it becomes the bottleneck.

## Trying the PoC

A workflow-dispatch run of `backend.yml` uses the full-run coloring path. A PR
can also take that path with the existing `Trigger: Override Selective Testing`
label. Normal selective PR runs exercise the unchanged planner instead.

Each shard logs its color and file counts through `pytest-selected.py` and
writes the existing `.artifacts/full-tests.shard-N.txt` and `.json` plan files.
Compare the processing shard and general shard completion times after checking
that the complete file/node inventory still runs with no new skips. The existing
22-job limit remains unchanged if the processing shard becomes too slow; any
later additional processing shard must replace a general shard.

Planner checks run without starting services:

```bash
.venv/bin/pytest -c .github/workflows/scripts/pytest.ini \
  .github/workflows/scripts/test_pytest_selected.py
```

Docker-backed execution is still needed to validate live-service isolation and
elapsed time. This patch does not claim a measured speedup.
