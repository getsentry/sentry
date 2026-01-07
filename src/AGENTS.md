# Backend Development Guide

> For critical commands and security guidelines, see `/AGENTS.md` in the repository root.

## Overview

Sentry is a developer-first error tracking and performance monitoring platform. This repository contains the main Sentry application, which is a large-scale Django application with a React frontend.

## Tech Stack

### Backend

- **Language**: Python 3.13+
- **Framework**: Django 5.2+
- **API**: Django REST Framework with drf-spectacular for OpenAPI docs
- **Task Queue**: Celery 5.5+
- **Databases**: PostgreSQL (primary), Redis, ClickHouse (via Snuba)
- **Message Queue**: Kafka, RabbitMQ
- **Stream Processing**: Arroyo (Kafka consumer/producer framework)
- **Cloud Services**: Google Cloud Platform (Bigtable, Pub/Sub, Storage, KMS)

### Infrastructure

- **Container**: Docker (via devservices)
- **Package Management**: pnpm (Node.js), pip (Python)
- **Node Version**: 22 (managed by Volta)

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

## Command Execution Requirements

**CRITICAL**: When running Python commands (pytest, mypy, pre-commit, etc.), you MUST use the virtual environment.

### For AI Agents (automated commands)

Use the full relative path to virtualenv executables:

```bash
cd /path/to/sentry && .venv/bin/pytest tests/...
cd /path/to/sentry && .venv/bin/python -m mypy ...
```

Or source the activate script in your command:

```bash
cd /path/to/sentry && source .venv/bin/activate && pytest tests/...
```

**Important for AI agents:**

- Always use `required_permissions: ['all']` when running Python commands to avoid sandbox permission issues
- The `.venv/bin/` prefix ensures you're using the correct Python interpreter and dependencies

### For Human Developers (interactive shells)

Run `direnv allow` once to trust the `.envrc` file. After that, direnv will automatically activate the virtual environment when you cd into the directory.

```bash
cd /path/to/sentry
direnv allow  # Only needed once, or after .envrc changes
# Now pytest, python, etc. will automatically use .venv
```

## Security Guidelines

### Preventing Indirect Object References (IDOR)

**Indirect Object Reference** vulnerabilities occur when an attacker can access resources they shouldn't by manipulating IDs passed in requests. This is one of the most critical security issues in multi-tenant applications like Sentry.

**Core Principle: Always Scope Queries by Organization/Project**

When querying resources, ALWAYS include `organization_id` and/or `project_id` in your query filters. Never trust user-supplied IDs alone.

```python
# WRONG: Vulnerable to IDOR - user can access any resource by guessing IDs
resource = Resource.objects.get(id=request.data["resource_id"])

# RIGHT: Properly scoped to organization
resource = Resource.objects.get(
    id=request.data["resource_id"],
    organization_id=organization.id
)

# RIGHT: Properly scoped to project
resource = Resource.objects.get(
    id=request.data["resource_id"],
    project_id=project.id
)
```

**Project ID Handling: Use `self.get_projects()`**

When project IDs are passed in the request (query string or body), NEVER directly access or trust `request.data["project_id"]` or `request.GET["project_id"]`. Instead, use the endpoint's `self.get_projects()` method which performs proper permission checks.

```python
# WRONG: Direct access bypasses permission checks
project_ids = request.data.get("project_id")
projects = Project.objects.filter(id__in=project_ids)

# RIGHT: Use self.get_projects() which validates permissions
projects = self.get_projects(
    request=request,
    organization=organization,
    project_ids=request.data.get("project_id")
)
```

## Exception Handling

- Avoid blanket exception handling (`except Exception:` or bare `except:`)
- Only catch specific exceptions when you have a meaningful way to handle them
- We have global exception handlers in tasks and endpoints that automatically log errors and report them to Sentry
- Let exceptions bubble up unless you need to:
  - Add context to the error
  - Perform cleanup operations
  - Convert one exception type to another with additional information
  - Recover from expected error conditions

## Development Commands

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

> **See "Command Execution Requirements" above** for critical `direnv allow` guidance.

### Linting

```bash
# Preferred: Run pre-commit hooks on specific files
pre-commit run --files src/sentry/path/to/file.py

# Run all pre-commit hooks
pre-commit run --all-files
```

### Testing

```bash
# Run Python tests (always use these parameters)
pytest -svv --reuse-db

# Run specific test file
pytest tests/sentry/api/test_base.py
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

## Development Services

Sentry uses `devservices` to manage local development dependencies:

- **PostgreSQL**: Primary database
- **Redis**: Caching and queuing
- **Snuba**: ClickHouse-based event storage
- **Relay**: Event ingestion service
- **Symbolicator**: Debug symbol processing
- **Taskbroker**: Asynchronous task processing
- **Spotlight**: Local debugging tool

📖 Full devservices documentation: https://develop.sentry.dev/development-infrastructure/devservices.md

## AI Assistant Quick Decision Trees

### "User wants to add an API endpoint"

1. Check if endpoint already exists: `grep -r "endpoint_name" src/sentry/api/`
2. Inherit from appropriate base:
   - Organization-scoped: `OrganizationEndpoint`
   - Project-scoped: `ProjectEndpoint`
   - Region silo: `RegionSiloEndpoint`
3. File locations:
   - Endpoint: `src/sentry/api/endpoints/{resource}.py`
   - URL: `src/sentry/api/urls.py`
   - Test: `tests/sentry/api/endpoints/test_{resource}.py`
   - Serializer: `src/sentry/api/serializers/models/{model}.py`

### "User wants to add a Celery task"

1. Location: `src/sentry/tasks/{category}.py`
2. Use `@instrumented_task` decorator
3. Set appropriate `queue` and `max_retries`
4. Test location: `tests/sentry/tasks/test_{category}.py`

## Critical Patterns (Copy-Paste Ready)

### API Endpoint Pattern

```python
# src/sentry/core/endpoints/organization_details.py
from rest_framework.request import Request
from rest_framework.response import Response
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import DetailedOrganizationSerializer

@region_silo_endpoint
class OrganizationDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """Get organization details."""
        return Response(
            serialize(
                organization,
                request.user,
                DetailedOrganizationSerializer()
            )
        )

# Add to src/sentry/api/urls.py:
# path('organizations/<slug:organization_slug>/', OrganizationDetailsEndpoint.as_view()),
```

### Serializers: Avoiding N+1 Queries

**Rule**: NEVER query the database in `serialize()` for bulk requests, always use `get_attrs()`.

The `serialize()` function in `base.py` calls `get_attrs()` once with all objects, then `serialize()` once per object:

```python
# ❌ WRONG: Query runs once per object (N+1)
class MySerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        data = RelatedModel.objects.filter(obj=obj).first()  # NO!
        return {"id": obj.id, "data": data}

# ✅ CORRECT: Bulk query in get_attrs
class MySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        # Query once for all items
        data_by_id = {
            d.object_id: d.value
            for d in RelatedModel.objects.filter(object__in=item_list)
        }
        return {item: {"data": data_by_id.get(item.id)} for item in item_list}

    def serialize(self, obj, attrs, user, **kwargs):
        return {"id": obj.id, "data": attrs.get("data")}

# Extending serializers
class DetailedSerializer(MySerializer):
    def get_attrs(self, item_list, user, **kwargs):
        attrs = super().get_attrs(item_list, user)  # Call parent first

        # Add more bulk queries
        extra_by_id = {e.id: e for e in Extra.objects.filter(item__in=item_list)}
        for item in item_list:
            attrs[item]["extra"] = extra_by_id.get(item.id)
        return attrs
```

### Celery Task Pattern

```python
# src/sentry/tasks/email.py
from sentry.tasks.base import instrumented_task

@instrumented_task(
    name="sentry.tasks.send_email",
    queue="email",
    max_retries=3,
    default_retry_delay=60,
)
def send_email(user_id: int, subject: str, body: str) -> None:
    from sentry.models import User

    try:
        user = User.objects.get(id=user_id)
        # Send email logic
    except User.DoesNotExist:
        # Don't retry if user doesn't exist
        return
```

## API Development

### Adding New Endpoints

1. Create endpoint in `src/sentry/api/endpoints/`
2. Add URL pattern in `src/sentry/api/urls.py`
3. Document with drf-spectacular decorators
4. Add tests in `tests/sentry/api/endpoints/`

### API Documentation

- OpenAPI spec generation: `make build-api-docs`
- API ownership tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`

### API Design Rules

1. Route: `/api/0/organizations/{org}/projects/{project}/`
2. Use `snake_case` for URL params
3. Use `camelCase` for request/response bodies
4. Return strings for numeric IDs
5. Implement pagination with `cursor`
6. Use `GET` for read, `POST` for create, `PUT` for update
7. **Error responses MUST use `"detail"` key** (Django REST Framework convention)

### Error Response Convention

Following Django REST Framework standards, all error responses must use `"detail"` as the key for error messages.

```python
from django.http import JsonResponse
from rest_framework.response import Response

# ✅ CORRECT: Use "detail" for error messages
return JsonResponse({"detail": "Internal server error"}, status=500)
return Response({"detail": "Invalid input"}, status=400)

# ❌ WRONG: Don't use "error" or other keys
return JsonResponse({"error": "Internal server error"}, status=500)
return Response({"message": "Invalid input"}, status=400)
```

**Why `detail`?**

- Standard Django REST Framework convention
- Consistent with existing Sentry codebase
- Expected by API clients and error handlers

## Common Patterns

### Feature Flags

```python
from sentry import features

if features.has('organizations:new-feature', organization):
    # New feature code
```

### Permissions

```python
from sentry.api.permissions import SentryPermission

class MyPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:write'],
    }
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

### Logging Pattern

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

### Arroyo Stream Processing

```python
# Using Arroyo for Kafka producers with dependency injection for testing
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaProducer, KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage

# Production producer
def create_kafka_producer(config):
    return KafkaProducer(build_kafka_configuration(default_config=config))

# Test producer using Arroyo's LocalProducer
def create_test_producer_factory():
    storage = MemoryMessageStorage()
    broker = LocalBroker(storage)
    return lambda config: broker.get_producer(), storage

# Dependency injection pattern for testable Kafka producers
class MultiProducer:
    def __init__(self, topic: Topic, producer_factory: Callable[[Mapping[str, object]], Producer[KafkaPayload]] | None = None):
        self.producer_factory = producer_factory or self._default_producer_factory
        # ... setup code

    def _default_producer_factory(self, config) -> KafkaProducer:
        return KafkaProducer(build_kafka_configuration(default_config=config))
```

## Code Comments

Comments should not repeat what the code is saying. Instead, reserve comments for explaining **why** something is being done, or to provide context that is not obvious from the code itself.

```python
# Bad - obvious from the code itself
result = self.create_project(organization=org)  # Create a project

# Good - explains why
# Some APIs occasionally return 500s on valid requests. We retry up to
# 3 times before surfacing an error.
retries += 1

# Good - provides non-obvious context
# Seer requires at least 10 events before it can analyze patterns
if event_count < 10:
    return None
```

**When to Comment:**

- To explain why a particular approach or workaround was chosen
- To clarify intent when the code could be misread or misunderstood
- To provide context from external systems, specs, or requirements
- To document assumptions, edge cases, or limitations
- To explain non-obvious business logic or domain knowledge

**When Not to Comment:**

- Don't narrate what the code is doing — the code already says that
- Don't duplicate function or variable names in plain English
- Don't leave stale comments that contradict the code
- Don't reference removed or obsolete code paths (e.g. "No longer uses X format")
- Don't comment on obvious test setup steps (e.g. "Create organization", "Call the API")

## Architecture Rules

### Silo Mode

- **Control Silo**: User auth, billing, organization management
- **Region Silo**: Project data, events, issues
- Check model's silo in `src/sentry/models/outbox.py`
- Use `@region_silo_endpoint` or `@control_silo_endpoint`

### Database Guidelines

1. NEVER join across silos
2. Use `outbox` for cross-silo updates
3. Migrations must be backwards compatible
4. Add indexes for queries on 1M+ row tables
5. Use `db_index=True` or `db_index_together`

#### Composite Index Strategy: Match Your Query Patterns

**Critical Rule**: When writing a query that filters on multiple columns simultaneously, you MUST verify that a composite index exists covering those columns in the filter order.

**How to Identify When You Need a Composite Index:**

1. **Look for Multi-Column Filters**: Any query using multiple columns in `.filter()` or `WHERE` clause
2. **Check Index Coverage**: Verify the model's `Meta.indexes` includes those columns
3. **Consider Query Order**: Index column order should match the most selective filters first

**Common Patterns Requiring Composite Indexes:**

```python
# NEEDS COMPOSITE INDEX: Filtering on foreign_key_id AND id
Model.objects.filter(
    foreign_key_id__in=ids,  # First column
    id__gt=last_id           # Second column
)[:batch_size]
# Required: Index(fields=["foreign_key", "id"])

# NEEDS COMPOSITE INDEX: Status + timestamp range queries
Model.objects.filter(
    status="open",           # First column
    created_at__gte=start    # Second column
)
# Required: Index(fields=["status", "created_at"])

# NEEDS COMPOSITE INDEX: Org + project + type lookups
Model.objects.filter(
    organization_id=org_id,  # First column
    project_id=proj_id,      # Second column
    type=event_type          # Third column
)
# Required: Index(fields=["organization", "project", "type"])
```

**How to Check if Index Exists:**

1. Read the model file: Check the `Meta` class for `indexes = [...]`
2. Single foreign key gets auto-index, but **NOT** when combined with other filters
3. If you filter on FK + another column, you need explicit composite index

**Red Flags to Watch For:**

- Query uses `column1__in=[...]` AND `column2__gt/lt/gte/lte`
- Query filters on FK relationship PLUS primary key or timestamp
- Pagination queries combining filters with cursor-based `id__gt`
- Large IN clauses combined with range filters

**When in Doubt:**

1. Check production query performance in Sentry issues (slow query alerts)
2. Run `EXPLAIN ANALYZE` on similar queries against production-sized data
3. Add the composite index if table has 1M+ rows and query runs in loops/batches

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

## Performance Considerations

1. Use database indexing appropriately
2. Implement pagination for list endpoints
3. Cache expensive computations with Redis
4. Use Celery for background tasks
5. Optimize queries with `select_related` and `prefetch_related`

## Debugging Tips

1. Use `devservices serve` for full stack debugging
2. Access Django shell: `sentry django shell`
3. View Celery tasks: monitor RabbitMQ management UI
4. Database queries: use Django Debug Toolbar

### Quick Debugging

```python
# Print SQL queries
from django.db import connection
print(connection.queries)

# Debug Celery task
from sentry.tasks import my_task
my_task.apply(args=[...]).get()  # Run synchronously

# Check feature flag
from sentry import features
features.has('organizations:feature', org)

# Current silo mode
from sentry.silo import SiloMode
from sentry.services.hybrid_cloud import silo_mode_delegation
print(silo_mode_delegation.get_current_mode())
```

## Important Configuration Files

- `pyproject.toml`: Python project configuration
- `setup.cfg`: Python package metadata
- `.github/`: CI/CD workflows
- `devservices/config.yml`: Local service configuration
- `.pre-commit-config.yaml`: Pre-commit hooks configuration

## File Location Map

### Backend

- **Models**: `src/sentry/models/{model}.py`
- **API Endpoints**: `src/sentry/api/endpoints/{resource}.py`
- **Serializers**: `src/sentry/api/serializers/models/{model}.py`
- **Tasks**: `src/sentry/tasks/{category}.py`
- **Integrations**: `src/sentry/integrations/{provider}/`
- **Permissions**: `src/sentry/api/permissions.py`
- **Feature Flags**: `src/sentry/features/permanent.py` or `temporary.py`
- **Utils**: `src/sentry/utils/{category}.py`

## Integration Development

### Adding Integration

1. Create dir: `src/sentry/integrations/{name}/`
2. Required files:
   - `__init__.py`
   - `integration.py` (inherit from `Integration`)
   - `client.py` (API client)
   - `webhooks/` (if needed)
3. Register in `src/sentry/integrations/registry.py`
4. Add feature flag in `temporary.py`

### Integration Pattern

```python
# src/sentry/integrations/example/integration.py
from sentry.integrations import Integration, IntegrationProvider

class ExampleIntegration(Integration):
    def get_client(self):
        from .client import ExampleClient
        return ExampleClient(self.metadata['access_token'])

class ExampleIntegrationProvider(IntegrationProvider):
    key = "example"
    name = "Example"
    features = ["issue-basic", "alert-rule"]

    def build_integration(self, state):
        # OAuth flow handling
        pass
```

## Contributing Guidelines

1. Follow existing code style
2. Write comprehensive tests
3. Update documentation
4. Add feature flags for experimental features
5. Consider backwards compatibility
6. Performance test significant changes

## Common Gotchas

1. **Hybrid Cloud**: Check silo mode before cross-silo queries
2. **Feature Flags**: Always add for new features
3. **Migrations**: Test rollback, never drop columns immediately
4. **Celery**: Always handle task failures/retries
5. **API**: Serializers can be expensive, use `@attach_scenarios`
6. **Tests**: Use `self.create_*` helpers, not direct model creation
7. **Permissions**: Check both RBAC and scopes

## Useful Resources

- Development Setup Guide: https://develop.sentry.dev/getting-started/
- Devservices Documentation: https://develop.sentry.dev/development-infrastructure/devservices
- Main Documentation: https://docs.sentry.io/
- Internal Contributing Guide: https://docs.sentry.io/internal/contributing/
- GitHub Discussions: https://github.com/getsentry/sentry/discussions
- Discord: https://discord.gg/PXa5Apfe7K

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
