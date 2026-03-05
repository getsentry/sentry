# Python Testing Guide

> For critical test commands, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## How to Determine Where to Add New Test Cases

When fixing errors or adding functionality, you MUST add test cases to existing test files rather than creating new test files. Follow this pattern to locate the correct test file:

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

Notice that we prefix `tests/` to the path and prefix `test_` to the module name.

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. The tests in this folder will also run in Snuba's CI.

## Parallel Test Execution

Multiple `pytest` processes can run simultaneously without interference. Each process automatically gets isolated PostgreSQL databases, Redis DBs, and Kafka topics via `src/sentry/testutils/pytest/isolation.py`.

### Running tests in parallel

Use `pytest -n4` to distribute tests across 4 workers via the built-in `sentry-parallel` plugin, or just run multiple independent `pytest` invocations (auto-allocated via file locks).

### How isolation works

- **No env vars needed** — plain `pytest` auto-isolates by default via file-lock slot allocation.
- **`SENTRY_PYTEST_SERIAL=1`** — disables isolation (old single-process behaviour).
- **`SENTRY_TEST_WORKER_ID=N`** — explicitly assign a slot (set automatically by `-n`).
- **Max 15 parallel slots** — constrained by Redis DB limit (DBs 1–15).
- **PostgreSQL** — each slot gets uniquely suffixed databases (e.g., `region_0`, `control_0`).
- **Redis** — each slot gets its own DB number (1–15), no cross-session data leaks.
- **Kafka** — topics are suffixed with the worker ID (e.g., `ingest-events-0`).
- **ClickHouse/Snuba** — tables are _not_ truncated between tests. Isolation relies on PostgreSQL sequence uniqueness: each test gets fresh `project_id`s that never collide, so ClickHouse rows from other tests are invisible. Tests that query ClickHouse without filtering by `project_id` may see cross-worker data.
- **`--reuse-db`** — works because slot-based suffixes are stable across runs.

### Output modes

- **Default** — dots (`.Fs`) with an in-place progress counter on TTYs; plain streaming dots on CI pipes.
- **`-v` / `--verbose`** — full per-test lines: `[w0] tests/sentry/foo/test_bar.py::TestClass::test_method PASSED (0.42s)`.
- **Failures** — always print the full traceback regardless of verbosity.

## Testing Best Practices

### Python Tests

- Use pytest fixtures
- Mock external services
- Test database isolation with transactions
- Use factories for test data
- For Kafka/Arroyo components: Use `LocalProducer` with `MemoryMessageStorage` instead of mocks

### Test Pattern

```python
# tests/sentry/core/endpoints/test_organization_details.py
from sentry.testutils.cases import APITestCase

class OrganizationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def test_get_organization(self):
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)

        response = self.get_success_response(org.slug)
        assert response.data["id"] == str(org.id)
```

Notes:

- Tests should ALWAYS be procedural with NO branching logic. It is very rare
  that you will need an if statement as part of a backend test.

## Use Factories Instead of Directly Calling `Model.objects.create`

In Sentry Python tests, you MUST use factory methods in this priority order:

1. Fixture methods (e.g., `self.create_model`) from base classes like `sentry.testutils.fixtures.Fixtures`
2. Factory methods from `sentry.testutils.factories.Factories` when fixtures aren't available

NEVER directly call `Model.objects.create` - this violates our testing standards and bypasses shared test setup logic.

For example, a diff that uses a fixture instead of directly calling `Model.objects.create` would look like:

```diff
-        direct_project = Project.objects.create(
-            organization=self.organization,
-            name="Directly Created",
-            slug="directly-created"
-        )
+        direct_project = self.create_project(
+            organization=self.organization,
+            name="Directly Created",
+            slug="directly-created" # Note: Ensure factory args match
+        )
```

## Use `pytest` Instead of `unittest`

In Sentry Python tests, always use `pytest` instead of `unittest`. This promotes consistency, reduces boilerplate, and leverages shared test setup logic defined in the factories.

For example, a diff that uses `pytest` instead of `unittest` would look like:

```diff
-        self.assertRaises(ValueError, EffectiveGrantStatus.from_cache, None)
+        with pytest.raises(ValueError):
+            EffectiveGrantStatus.from_cache(None)
```

## File Location Map

### Tests

- **Python**: `tests/` mirrors `src/` structure
- **Fixtures**: `fixtures/{type}/`
- **Factories**: `tests/sentry/testutils/factories.py`

## Rule Enforcement

These rules are MANDATORY for all Python development in the Sentry codebase. Violations will:

- Cause CI failures
- Require code review rejection
- Must be fixed before merging the pull request

Agents MUST follow these rules without exception to maintain code quality and consistency across the project.
