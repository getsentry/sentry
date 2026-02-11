# Hybrid Tiered xdist CI Strategy

## Problem

Sentry's backend CI runs ~15,000 tests single-threaded. The main bottleneck for
parallelization is `reset_snuba` — a fixture that calls `TRUNCATE TABLE` on every
ClickHouse dataset before each SnubaTestCase test. Since TRUNCATE is table-wide,
running Snuba tests in parallel under xdist causes workers to wipe each other's data.

## Solution

A three-tier hybrid approach that combines **runtime service classification** with a
**"no cleanup" xdist strategy**:

### Tier 1: Postgres + Redis only (no Snuba stack)

- ~71% of tests, identified at runtime via socket monitoring (`service_classifier.py`)
- Runs with `devservices mode: migrations` (lighter containers, faster setup)
- xdist `-n 3` — more RAM headroom since no ClickHouse/Kafka/Snuba containers
- 4 shards

### Tier 2 Parallel: Full Snuba stack, xdist

- ~28% of tests (Snuba-dependent), minus FORCE_SERIAL_FILES
- `XDIST_SKIP_SNUBA_RESET=1` makes `reset_snuba` a no-op
- Tests rely on **unique snowflake IDs** (project_id, org_id) for ClickHouse isolation
  instead of TRUNCATE TABLE
- xdist `-n 2` — conservative due to higher memory usage with full stack
- 15 shards

### Tier 2 Serial: Full Snuba stack, single-threaded

- ~26 files + `tests/relay_integration/` directory with broadly-scoped ClickHouse
  queries that fail without TRUNCATE (defined in `FORCE_SERIAL_FILES` / `FORCE_SERIAL_DIRS`)
- Normal `reset_snuba` cleanup, no xdist
- 3 shards

## Key Changes

| File                                                | Change                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/sentry/testutils/pytest/sentry.py`             | `FORCE_SERIAL_FILES`, `FORCE_SERIAL_DIRS`, `_force_serial()`, `--xdist-group` option, per-worker Redis DB, per-worker region snowflake IDs |
| `src/sentry/testutils/pytest/fixtures.py`           | `reset_snuba` skips TRUNCATE when `XDIST_SKIP_SNUBA_RESET` is set                                                                          |
| `src/sentry/testutils/pytest/service_classifier.py` | Runtime service classification plugin (socket monitoring + static markers)                                                                 |
| `src/sentry/testutils/pytest/__init__.py`           | Register `service_classifier` plugin                                                                                                       |
| `.github/workflows/backend-xdist-split-poc.yml`     | Hybrid tiered workflow (split-tiers → tier1 / tier2-parallel / tier2-serial)                                                               |
| `.github/workflows/classify-services.yml`           | Generates runtime classification JSON                                                                                                      |
| `.github/workflows/scripts/split-tests-by-tier.py`  | Splits test files into tier1/tier2 based on classification                                                                                 |
| `tests/sentry/utils/test_sdk.py`                    | Fix: `test_custom_transaction_name` patched wrong scope (isolation vs current) — exposed by xdist                                          |

## How Snowflake ID Isolation Works

Each xdist worker gets a unique `region_snowflake_id` (via `PYTEST_XDIST_WORKER` env var).
Snowflake IDs encode the region ID in a 12-bit segment, so `project_id` and `org_id` values
are globally unique across workers. Most Snuba queries filter by `project_id`, so workers
naturally see only their own data without needing TRUNCATE.

Tests in `FORCE_SERIAL_FILES` have queries that aggregate across all projects/orgs (e.g.,
dynamic sampling tasks, weekly reports) and cannot rely on this isolation.

## Test Bug Uncovered

xdist exposed a latent bug in `test_sdk.py::test_custom_transaction_name`: the test patched
`Scope.get_isolation_scope` but the production code reads `sentry_sdk.get_current_scope()`.
It passed single-threaded by accident (empty global scope). Under xdist, another worker's
test leaked `github.webhook.issue_comment` into the shared current scope, causing the
assertion to fail. Fixed by patching the correct scope object.
