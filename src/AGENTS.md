# Backend Development Guide

> For critical commands, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

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

## Development Services

Local dependencies are managed by `devservices` (config: `devservices/config.yml`).

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

## API Development

### Adding New Endpoints

1. Create endpoint in `src/sentry/api/endpoints/`
2. Add URL pattern in `src/sentry/api/urls.py`
3. Document with drf-spectacular decorators
4. Add tests in `tests/sentry/api/endpoints/`

### API Documentation

- OpenAPI spec generation: `make build-api-docs`
- API ownership tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`
- `@extend_schema(operation_id=...)`: use a short camelCase REST token, NOT a sentence.
  Form is `<verb><Resource>` — verb is `list` (GET collection), `get` (GET one), `create`
  (POST), `update` (PUT/PATCH), `delete` (DELETE); Resource comes from the path's nouns.
  e.g. `listOrganizationIssues`, `getOrganizationIssue`, `createProjectKey`. Put the
  human-readable title in `summary=` — that's what the API reference renders. Non-CRUD
  actions use the real verb: `add`, `start`, `enable`, `upload`, `link`, `resolve`, etc.

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
from rest_framework.response import Response

# ✅ CORRECT: Use "detail" for error messages
return Response({"detail": "Internal server error"}, status=500)
return Response({"detail": "Invalid input"}, status=400)

# ❌ WRONG: Don't use "error" or other keys
return Response({"error": "Internal server error"}, status=500)
return Response({"message": "Invalid input"}, status=400)
```

**Why `detail`?**

- Standard Django REST Framework convention
- Consistent with existing Sentry codebase
- Expected by API clients and error handlers

## Common Patterns

### Feature Flags

See **Feature Flags (FlagPole)** in `/AGENTS.md` for registration, the `features.has(...)` check, and test usage.

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

## Architecture Rules

### Silo Mode

- **Control Silo**: User auth, billing, organization management
- **Region Silo**: Project data, events, issues
- Check model's silo in `src/sentry/models/outbox.py`
- Use `@cell_silo_endpoint` or `@control_silo_endpoint`

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
