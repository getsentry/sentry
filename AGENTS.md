# Sentry Development Guide for AI Agents

> **IMPORTANT**: AGENTS.md files are the source of truth for AI agent instructions. Always update the relevant AGENTS.md file when adding or modifying agent guidance. do not add to CLAUDE.md or cursor rules

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Project Structure

```
sentry/
├── src/
│   ├── sentry/           # Main Django application
│   │   ├── api/          # REST API endpoints
│   │   ├── models/       # Django models
│   │   ├── tasks/        # Celery tasks
│   │   ├── integrations/ # Third-party integrations
│   │   ├── issues/       # Issue tracking logic
│   │   └── web/          # Web views and middleware
│   ├── sentry_plugins/   # Plugin system
│   └── social_auth/      # Social authentication
├── static/               # Frontend application
├── tests/                # Test suite
├── fixtures/             # Test fixtures
├── devenv/               # Development environment config
├── migrations/           # Database migrations
└── config/               # Configuration files
```

> For detailed development patterns, see nested AGENTS.md files:
>
> - **Backend patterns**: `src/AGENTS.md`
> - **Testing patterns**: `tests/AGENTS.md`
> - **Frontend patterns**: `static/AGENTS.md`

## Backend

### Commands

#### Linting

```bash
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files
```

#### Testing

```bash
# Run Python tests (always use these parameters)
pytest -svv --reuse-db

# Run specific test file
pytest tests/sentry/api/test_base.py
```

### Testing Rules

#### Test File Location

- Code location: `src/sentry/foo/bar.py`
- Test location: `tests/sentry/foo/test_bar.py`

**Exception**: Tests ensuring Snuba compatibility MUST be placed in `tests/snuba/`. The tests in this folder will also run in Snuba's CI.

#### Use Fixtures Instead of `Model.objects.create`

In Sentry Python tests, you MUST use factory methods in this priority order:

1. Fixture methods (e.g., `self.create_model`) from base classes like `sentry.testutils.fixtures.Fixtures`
2. Factory methods from `sentry.testutils.factories.Factories` when fixtures aren't available

NEVER directly call `Model.objects.create` - this violates our testing standards and bypasses shared test setup logic.

```diff
-        direct_project = Project.objects.create(
-            organization=self.organization,
-            name="Directly Created",
-            slug="directly-created"
-        )
+        direct_project = self.create_project(
+            organization=self.organization,
+            name="Directly Created",
+            slug="directly-created"
+        )
```

#### Use `pytest` Instead of `unittest`

In Sentry Python tests, always use `pytest` instead of `unittest`.

```diff
-        self.assertRaises(ValueError, EffectiveGrantStatus.from_cache, None)
+        with pytest.raises(ValueError):
+            EffectiveGrantStatus.from_cache(None)
```

### Code Comments

Comments should not repeat what the code is saying. Instead, reserve comments for explaining **why** something is being done, or to provide context that is not obvious from the code itself.

```py
# Bad - narrates what the code does
retries += 1

# Good - explains why
# Some APIs occasionally return 500s on valid requests. We retry up to 3 times
# before surfacing an error.
retries += 1
```

**When to Comment:**

- To explain why a particular approach or workaround was chosen
- To clarify intent when the code could be misread or misunderstood
- To provide context from external systems, specs, or requirements
- To document assumptions, edge cases, or limitations

**When Not to Comment:**

- Don't narrate what the code is doing — the code already says that
- Don't duplicate function or variable names in plain English
- Don't leave stale comments that contradict the code
- Don't reference removed or obsolete code paths (e.g. "No longer uses X format")

## Frontend

### Commands

#### Linting

```bash
# JavaScript/TypeScript linting
pnpm run lint:js

# Linting for specific file(s)
pnpm run lint:js components/avatar.tsx [...other files]

# Fix linting issues
pnpm run fix
```

#### Testing

```bash
# Run JavaScript tests (always use CI flag)
CI=true pnpm test <file_path>

# Run specific test file(s)
CI=true pnpm test components/avatar.spec.tsx
```

### General Frontend Rules

1. NO new Reflux stores
2. NO class components
3. NO CSS files (use [core components](./app/components/core/) or Emotion in edge cases)
4. ALWAYS use TypeScript
5. ALWAYS colocate tests
6. Lazy load routes: `React.lazy(() => import('...'))`
