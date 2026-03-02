# Other CI Jobs — Investigation Notes

## Backend Migration Tests (13m58s baseline)

### What it does
Runs ~8 active data migration tests (out of 32 files, 24 permanently skipped). Each test: rolls DB back to pre-migration state → inserts test data → runs migration forward → asserts data transformed correctly. Uses `--migrations` flag (Django applies all ~900+ migrations sequentially instead of fast `syncdb`).

### Command
```
PYTEST_ADDOPTS="-m migrations --migrations --reruns 0 --fail-slow=120s" make test-python-ci
```
Which expands to `pytest tests/ --reuse-db ...` targeting ALL of tests/ then filtering by marker.

### Key findings
- `-m migrations` filtering happens AFTER full collection — all 20K+ tests collected, then 99.96% discarded
- 24/32 migration test files are `@pytest.mark.skip` (permanently skipped, one-time data migrations already run in prod)
- Uses `mode: default` but only needs postgres (+ snuba for 1 test)
- Migration test files live in only 5 directories: `tests/sentry/migrations`, `tests/sentry/monitors/migrations`, `tests/sentry/workflow_engine/migrations`, `tests/sentry/uptime/migrations`, `tests/sentry/preprod/migrations`

### Validated optimization
Targeting specific directories + `mode: backend-ci`: 9m04s (7 passed, 1 failed due to needing Snuba). The Snuba-dependent test is `test_0099_backfill_metric_issue_detectorgroup`.

### Proposed fix
```bash
python3 -b -m pytest \
  tests/sentry/migrations \
  tests/sentry/monitors/migrations \
  tests/sentry/workflow_engine/migrations \
  tests/sentry/uptime/migrations \
  tests/sentry/preprod/migrations \
  --migrations --reruns 0 --fail-slow=120s --reuse-db
```
With `mode: backend-ci` (has Snuba). Expected savings: ~5 min.

---

## Monolith-DBs Tests (8m17s baseline)

### What it does
Runs 104 backup/import/export tests with `SENTRY_USE_MONOLITH_DBS=1` (single DB instead of 3-database silo split). Simulates self-hosted Sentry which runs in monolith mode. Validates the atomic-transaction import path in `imports.py` that only runs in monolith mode.

### Why it exists
`imports.py:533-544` has a real code branch: monolith imports are wrapped in `transaction.atomic` and clear all tables first. Hybrid-mode imports don't. Without this suite, bugs in that path would only affect self-hosted users.

### Key findings
- `SENTRY_LEGACY_TEST_SUITE=1` env var is dead — nothing reads it
- `test_deleteme` marker expired 2023-11-11 (2+ years ago), but uses `@pytest.mark.skipif(reason="not legacy")` with no condition — always skipped, dead canary
- Only 3 tests are monolith-exclusive; ~101 are redundant with regular CI
- xdist `-n 2` NOT VIABLE — `TransactionTestCase` flushes entire DB, workers destroy each other's state. Ran 20+ min before being cancelled.

### Proposed optimizations
- Delete dead `SENTRY_LEGACY_TEST_SUITE=1` from Makefile
- Delete dead `test_deleteme`
- Consider reducing to 3-10 essential monolith-exclusive tests (~4-5 min savings)

---

## API Docs Tests (5m48s baseline)

### What it does
Generates OpenAPI spec from Django endpoints, validates API examples, runs 43 pytest tests that hit endpoints via Django test client and check responses match schema. Creates orgs/projects/events as test data.

### Service requirements
- Postgres: YES (Django ORM)
- Snuba: YES (`@requires_snuba` on base class, 3 tests explicitly query Snuba)
- Relay: NO (tests use Django test client)
- Spotlight: NO (dev debugging tool)

### Validated optimization
`mode: minimal` (postgres + snuba): PASSED, saved 16s. Marginal because Relay/Spotlight are lightweight.

---

## CLI Test (2m11s baseline)
Smoke test: `sentry init`, `sentry help`, `sentry upgrade`, `sentry export --help`. No optimization worth pursuing.

## Backend Typing / mypy (4m14s baseline)
Runs mypy on full codebase. Could cache `.mypy_cache` for 30-90s savings.

---

## Test branches (for future reference)
- `mchen/test-migration-targeted` — targeted dirs + mode:migrations (1 test failed, needs Snuba)
- `mchen/test-apidocs-minimal` — mode:minimal (passed, 16s savings)
- `mchen/test-monolith-xdist` — xdist -n 2 (not viable, 20+ min)
