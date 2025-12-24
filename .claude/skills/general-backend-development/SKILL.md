---
name: general-backend-development
description: General guidelines that should be followed when working in the backend Django Python code.
---

# Backend Development

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Project Structure

- **Language**: Python 3.13+
- **Framework**: Django 5.2+
- **API**: Django REST Framework with drf-spectacular for OpenAPI docs
- **Task Queue**: Celery 5.5+
- **Databases**: PostgreSQL (primary), Redis, ClickHouse (via Snuba)
- **Message Queue**: Kafka, RabbitMQ
- **Stream Processing**: Arroyo (Kafka consumer/producer framework)
- **Cloud Services**: Google Cloud Platform (Bigtable, Pub/Sub, Storage, KMS)
- **Container**: Docker (via devservices)
- **Package Management**: pnpm (Node.js), pip (Python)
- **Node Version**: 22 (managed by Volta)

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

## Commands

**CRITICAL**: Before running ANY Python commands (pytest, mypy, pre-commit, etc.), you MUST activate the virtual environment:

```bash
direnv allow
```

This ensures you're using the correct Python interpreter and dependencies from `.venv`. Commands will fail or use the wrong Python environment without this step.

**When to run `direnv allow`:**

- Before running tests (`pytest`)
- Before running type checks (`mypy`)
- Before running any Python scripts
- At the start of any new terminal session

### Setup

```bash
# Install dependencies and setup development environment
make develop

# Or use the newer devenv command
devenv sync

# Activate the Python virtual environment (required for running tests and Python commands)
direnv allow

# Start dev dependencies
devservices up

# Start the development server
devservices serve
```

### Linting

```bash
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files

```

### Database Operations

```bash
# Run migrations
sentry django migrate

# Create new migration
sentry django makemigrations

# Update migration after rebase conflict (handles renaming, dependencies, lockfile)
./bin/update-migration <migration_name_or_number> <app_label>
# Example: ./bin/update-migration 0101_workflow_when_condition_group_unique workflow_engine

# Reset database
make reset-db
```

### Exception Handling

- Avoid blanket exception handling (`except Exception:` or bare `except:`)
- Only catch specific exceptions when you have a meaningful way to handle them
- We have global exception handlers in tasks and endpoints that automatically log errors and report them to Sentry
- Let exceptions bubble up unless you need to:
  - Add context to the error
  - Perform cleanup operations
  - Convert one exception type to another with additional information
  - Recover from expected error conditions

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

## Python Typing

### Recommended Practices

For function signatures, always use abstract types (e.g. `Sequence` over `list`) for input parameters and use specific return types (e.g. `list` over `Sequence`).

```python
# Good: Abstract input types, specific return types
def process_items(items: Sequence[Item]) -> list[ProcessedItem]:
    return [process(item) for item in items]

# Avoid: Specific input types, abstract return types
def process_items(items: list[Item]) -> Sequence[ProcessedItem]:
    return [process(item) for item in items]
```

Always import a type from the module `collections.abc` rather than the `typing` module if it is available (e.g. `from collections.abc import Sequence` rather than `from typing import Sequence`).

## Logging Pattern

```python
import logging
from sentry import analytics
from sentry.analytics.events.feature_used import FeatureUsedEvent  # does not exist, only for demonstration purposes

logger = logging.getLogger(__name__)

# Structured logging
logger.info(
    "user.action.complete",
    extra={
        "user_id": user.id,
        "action": "login",
        "ip_address": request.META.get("REMOTE_ADDR"),
    }
)

# IMPORTANT: LOG005 use exception() within an exception handler
# WRONG: Calling logger.error() when capturing exception
try:
    risky_operation()
except ValidationError as e:
    logger.error("error.invalid_payload")

# RIGHT: Use logger.exception() with a message when capturing an exception
try:
    risky_operation()
except ValidationError:
    logger.exception("error.invalid_payload")

# IMPORTANT: Avoid LOG011 - Never pre-format log messages with f-strings or .format()
# WRONG: Pre-formatting evaluates before logger call, even if logging is disabled
logger.info(f"User {user.id} completed {action}")
logger.info("User {} completed {}".format(user.id, action))

# RIGHT: Use logger's %-formatting for lazy evaluation
logger.info("%s.user.action.complete", PREFIX)

# ALSO RIGHT: Use structured logging with extra parameters only
logger.info(
    "user.action.complete", extra={"user_id": user.id}
)

# Analytics event
analytics.record(
    FeatureUsedEvent(
        user_id=user.id,
        organization_id=org.id,
        feature="new-dashboard",
    )
)
```

## Important Configuration Files

- `pyproject.toml`: Python project configuration
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration
- `.pre-commit-config.yaml`: Pre-commit hooks configuration
- `codecov.yml`: Code coverage configuration

## Anti-Patterns (NEVER DO)

```python
# WRONG: Direct model import in API
from sentry.models import Organization  # NO!

# RIGHT: Use endpoint bases
from sentry.api.bases.organization import OrganizationEndpoint

# WRONG: Synchronous external calls
response = requests.get(url)  # NO!

# RIGHT: Use Celery task
from sentry.tasks import fetch_external_data
fetch_external_data.delay(url)

# WRONG: N+1 queries
for org in organizations:
    org.projects.all()  # NO!

# RIGHT: Use prefetch_related
organizations.prefetch_related('projects')

# WRONG: Use hasattr() for unions
x: str | None = "hello"
if hasattr(x, "replace"):
    x = x.replace("e", "a")

# RIGHT: Use isinstance()
x: str | None = "hello"
if isinstance(x, str):
    x = x.replace("e", "a")

# WRONG: Importing inside function bodies.
# RIGHT: Import at the top of python modules. ONLY import in a function body if
# to avoid a circular import (very rare)
def my_function():
    from sentry.models.project import Project # NO!
    ...
```

### Feature Flags

```python
from sentry import features

if features.has('organizations:new-feature', organization):
    # New feature code
```

### Options System

Sentry uses a centralized options system where all options are registered in `src/sentry/options/defaults.py` with required default values.

```python
# CORRECT: options.get() without default - registered default is used
from sentry import options

batch_size = options.get("deletions.group-hash-metadata.batch-size")

# WRONG: Redundant default value
batch_size = options.get("deletions.group-hash-metadata.batch-size", 1000)
```

**Important**: Never suggest adding a default value to `options.get()` calls. All options are registered via `register()` in `defaults.py` which requires a default value. The options system will always return the registered default if no value is set, making a second default parameter redundant and potentially inconsistent.
