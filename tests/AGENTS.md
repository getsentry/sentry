# Python Testing Guide

> For test commands (`make test-selective`, `pytest`), see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.
>
> This guide covers Python tests. For frontend React/TypeScript tests (`*.spec.tsx`, RTL, `MockApiClient`), use the **`react-testing`** skill.

## How to Determine Where to Add New Test Cases

When fixing errors or adding functionality, you MUST add test cases to existing test files rather than creating new test files. Follow this pattern to locate the correct test file:

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

Notice that we prefix `tests/` to the path and prefix `test_` to the module name.

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. Snuba's CI runs Sentry tests by marker, not by folder: tests marked `@pytest.mark.snuba_ci` on every Snuba PR, and tests marked `snuba` (which `SnubaTestCase` and similar bases apply) when the Snuba API changes.

## Testing Best Practices

### Python Tests

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

## Date-stable tests (current or future year)

Flake8 **S015** rejects a current or future UTC year as a hardcoded test "now" at module or class scope, because that date drifts into Snuba retention. Use `before_now(...)` for relative time, or an older fixed year for an intentional historical fixture.

## EAP / Snuba endpoint tests (30d retention)

Snuba EAP outcomes routing defaults **standard retention to 30 days** and forces **tier 8** when the query start is older than that window. Sentry APIs still default unset windows to **90d**, so Snuba-integration tests that omit an explicit window under-count recent data (and rate functions like `epm()`/`eps()`/`tpm()` divide by the wrong window).

Shared defaults:

- `EAPClient` / `EAP_DEFAULT_STATS_PERIOD` (`src/sentry/testutils/helpers/eap.py`) inject `statsPeriod` of `EAP_DEFAULT_STATS_PERIOD_DAYS` (**29d**, one day under the limit to survive midnight-UTC rounding) for EAP datasets and known EAP paths.
- Suites that inherit `OrganizationEventsEndpointTestBase` also default through `client_get()` / `do_request()` to that same **29d** window (covers paths EAPClient heuristics miss, e.g. some trace-meta routes).

For those suites:

- Use `client_get()` or `do_request()`. Flake8 **S020** rejects raw `self.client.get(...)` in these suites.
- Keep query windows **≤30d** unless the test intentionally covers long-term retention / downsampling.
- Rate assertions (`epm`/`eps`/`tpm`/…) must use the **actual request window** (usually `EAP_DEFAULT_STATS_PERIOD_DAYS`), not a shorter hardcoded period.
- If you must query **>30d**, set the window **and** either send `standard_retention_days` (up to 90) or explicitly assert tier-8 / downsampled behavior. Do not weaken assertions just to make CI green.

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

## Backup/Relocation Test Coverage for Models

Adding a model with a `__relocation_scope__` other than `RelocationScope.Excluded`, or adding fields to one, fails the backup suite in `tests/sentry/backup/` until you update its fixtures and comparators. The steps are in `tests/sentry/backup/README.md`.

## File Location Map

### Tests

- **Python**: `tests/` mirrors `src/` structure
- **Fixtures**: `fixtures/{type}/`
- **Factories**: `src/sentry/testutils/factories.py`
