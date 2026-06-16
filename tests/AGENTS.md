# Python Testing Guide

> For test commands (`make test-selective`, `pytest`), see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## How to Determine Where to Add New Test Cases

When fixing errors or adding functionality, you MUST add test cases to existing test files rather than creating new test files. Follow this pattern to locate the correct test file:

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

Notice that we prefix `tests/` to the path and prefix `test_` to the module name.

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. The tests in this folder will also run in Snuba's CI.

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

Do not use the **current or future UTC calendar year** as a hardcoded test “now” at **module or class** scope (or in `freeze_time(datetime(...))`)—that date drifts into Snuba retention. Use **`before_now(...)`** (or `now - timedelta`) for relative time, or an older fixed year for intentional historical fixtures. Fixed timestamps in **function bodies** (fixtures, assertions) are fine.

Flake8 **S015** flags literals with year greater than or equal to the current UTC year in those scopes.

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

Every model with a `__relocation_scope__` other than `RelocationScope.Excluded` is automatically checked by the backup test suite in `tests/sentry/backup/`. When you add such a model (or add fields to one), CI will fail until you update the following:

1. **Exhaustive fixtures** (`src/sentry/testutils/helpers/backups.py`): create at least one instance of the model in the appropriate `create_exhaustive_*` method (e.g. `create_exhaustive_organization` for org/project-scoped models, `create_exhaustive_user` for user-scoped ones). Without this, `tests/sentry/backup/test_exhaustive.py` and the `ScopingTests` in `tests/sentry/backup/test_exports.py` / `test_imports.py` fail with "Some `expected_models` entries were not found" or "models were not included in the export".

2. **Comparators** (`get_default_comparators()` in `src/sentry/backup/comparators.py`): if the model has fields that change on import — e.g. `date_added`/`date_updated` from `DefaultFieldsModel` — register a comparator such as `DateUpdatedComparator("date_updated", "date_added")`. Without this, `test_exhaustive_dirty_pks` fails with `UnequalJSON` diffs on those fields.

3. **Coverage checks** (`tests/sentry/backup/test_coverage.py`) may additionally require:
   - a collision test in `tests/sentry/backup/test_imports.py` (`COLLISION_TESTED`) if the model has unique constraints not based on `Organization`/`Global`-scoped foreign keys;
   - a dynamic relocation scope test in `tests/sentry/backup/test_models.py` (`DYNAMIC_RELOCATION_SCOPE_TESTED`) if `__relocation_scope__` is a set of scopes.

See `tests/sentry/backup/README.md` for how the import/export/diff cycle and comparators work.

## File Location Map

### Tests

- **Python**: `tests/` mirrors `src/` structure
- **Fixtures**: `fixtures/{type}/`
- **Factories**: `tests/sentry/testutils/factories.py`
