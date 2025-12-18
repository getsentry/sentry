# Python Testing Guide

> For critical test commands, see `/AGENTS.md` in the repository root.

## Running Tests

Always run pytest with these parameters: `pytest -svv --reuse-db` since it is faster to execute.

## How to Determine Where to Add New Test Cases

When fixing errors or adding functionality, you MUST add test cases to existing test files rather than creating new test files. Follow this pattern to locate the correct test file:

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

Notice that we prefix `tests/` to the path and prefix `test_` to the module name.

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. The tests in this folder will also run in Snuba's CI.

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
  that you will need an if statement as part of a Frontend Jest test or backend
  pytest.

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

## Testing with Time

**CRITICAL**: All datetime objects in Sentry MUST be timezone-aware and use UTC.

```python
from sentry.testutils.helpers.datetime import before_now, freeze_time

# Get a datetime relative to now
past_time = before_now(days=7)  # 7 days ago in UTC

# Freeze time for testing
@freeze_time("2024-01-01 12:00:00")
def test_something():
    assert datetime.now(UTC).year == 2024
```

**Why Use Test Helpers:**

- `before_now()` ensures all test datetimes are UTC-aware and relative to now
- `freeze_time()` (from `time_machine` library) allows deterministic time-based testing
- Both helpers prevent timezone-related test flakiness across different environments

**Common Time-Based Test Patterns:**

```python
from datetime import UTC, datetime
from sentry.testutils.helpers.datetime import before_now, freeze_time

# Pattern 1: Testing time-sensitive features
def test_expired_data():
    expired_event = self.create_event(
        data={"timestamp": before_now(days=30).timestamp()}
    )
    assert expired_event.is_expired()

# Pattern 2: Testing time progression
@freeze_time("2024-01-01 10:00:00")
def test_scheduled_task():
    task = self.create_task(scheduled_at=datetime.now(UTC))
    assert task.should_run()

# Pattern 3: Testing date ranges
def test_date_filtering():
    start = before_now(days=7)
    end = before_now(days=1)
    events = Event.objects.filter(
        datetime__gte=start,
        datetime__lte=end
    )
    assert events.count() > 0
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
