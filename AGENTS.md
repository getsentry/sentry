# Sentry Development Patterns for AI Agents

This document contains system-wide architectural patterns and development workflows that complement the comprehensive guides in `CLAUDE.md` and `static/CLAUDE.md`.

## Development Environment

### Python Environment Setup

Whenever you attempt to run a Python command (e.g. `python -c`) or Python package (e.g. `pytest`, `mypy`), enable the virtualenv by activating it with `source .venv/bin/activate`.

## Testing Workflows

### Python Test Execution

Run pytest with these parameters:

```bash
pytest -svv --reuse-db
```

### React Test Execution

Always run React tests with the CI flag to use non-interactive mode:

```bash
CI=true pnpm test <file_path>
```

## Project Structure Patterns

### Test File Location Strategy

When fixing an error, do not place test cases in a new file but find an existing test file associated with the module.

**Standard Pattern:**

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`
- Pattern: Prefix `tests/` to the path and prefix `test_` to the module name

**Exception:**
Place tests in `tests/snuba/` when ensuring changes on Snuba will not break Sentry. These tests run in Snuba's CI process as well.

## Testing Philosophy & Architecture

### Core Testing Principles

- **User-centric testing:** Write tests that resemble how users interact with the app
- **Avoid implementation details:** Focus on behavior, not internal component structure
- **No shared state between tests:** Behavior should not be influenced by other tests in the test suite

### Python Testing Patterns

#### Use Factories Over Direct Model Creation

In Sentry Python tests, prefer using factory methods from `sentry.testutils.factories.Factories` or fixture methods (e.g., `self.create_model`) provided by base classes like `sentry.testutils.fixtures.Fixtures` instead of directly calling `Model.objects.create`. This promotes consistency, reduces boilerplate, and leverages shared test setup logic.

**Example:**

```python
# Instead of:
direct_project = Project.objects.create(
    organization=self.organization,
    name="Directly Created",
    slug="directly-created"
)

# Use:
direct_project = self.create_project(
    organization=self.organization,
    name="Directly Created",
    slug="directly-created"
)
```

#### Prefer pytest Over unittest

Use `pytest` instead of `unittest` for consistency and to leverage shared test setup logic.

**Example:**

```python
# Instead of:
self.assertRaises(ValueError, EffectiveGrantStatus.from_cache, None)

# Use:
with pytest.raises(ValueError):
    EffectiveGrantStatus.from_cache(None)
```

### React Testing Patterns

#### Avoid Mocking System Components

Do not use `jest.mocked()` for hooks, functions, or components. Instead:

- **For API calls:** Set response data with `MockApiClient.addMockResponse()`
- **For contexts:** Use provided configuration on `render()`
- **For routing:** Use `initialRouterConfig` parameter
- **For page filters:** Update corresponding data stores

#### Use Sentry Fixtures

Sentry fixtures are located in `tests/js/fixtures/` while GetSentry fixtures are in `tests/js/getsentry-test/fixtures/`.

**Example:**

```typescript
// Instead of:
import type {Project} from 'sentry/types/project';
const project: Project = {...}

// Use:
import {ProjectFixture} from 'sentry-fixture/project';
const project = ProjectFixture(partialProject)
```

#### Handle Network Request Testing

For components making network requests:

**Always await async assertions:**

```typescript
// Wrong - will fail intermittently
expect(screen.getByText('Loaded Data')).toBeInTheDocument();

// Correct - waits for element to appear
expect(await screen.findByText('Loaded Data')).toBeInTheDocument();
```

**Handle refetches in mutations:**

```typescript
it('adds item and updates list', async () => {
  // Initial empty state
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [],
  });

  const createRequest = MockApiClient.addMockResponse({
    url: '/items/',
    method: 'POST',
    body: {id: 1, name: 'New Item'},
  });

  render(<ItemList />);
  await userEvent.click(screen.getByRole('button', {name: 'Add Item'}));

  // CRITICAL: Override mock before refetch happens
  MockApiClient.addMockResponse({
    url: '/items/',
    body: [{id: 1, name: 'New Item'}],
  });

  await waitFor(() => expect(createRequest).toHaveBeenCalled());
  expect(await screen.findByText('New Item')).toBeInTheDocument();
});
```

## Integration with Existing Documentation

This file focuses on architectural patterns and workflows. For comprehensive system understanding, also reference:

- `/CLAUDE.md` - Backend architecture, API patterns, deployment
- `/static/CLAUDE.md` - Frontend architecture, component patterns, styling
- `.cursor/rules/` - File-specific coding standards and syntax preferences
