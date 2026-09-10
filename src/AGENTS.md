# Backend Development Guide

> For critical commands, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## Security Guidelines

### Preventing Indirect Object References (IDOR)

Multi-tenant queries MUST be scoped — never trust user-supplied IDs alone.

- Always filter by `organization_id` and/or `project_id`:
  `Resource.objects.get(id=..., organization_id=organization.id)`.
- Never read `request.data["project_id"]` / `request.GET["project_id"]` directly. Use `self.get_projects(request=request, organization=organization, project_ids=...)`, which validates permissions.

For access-control review or deeper authorization work, use the **`django-access-review`** and **`sentry-security`** skills.

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
4. Document with drf-spectacular decorators → use the **`document-api-endpoint`** skill.

### "User wants to add a Celery task"

1. Location: `src/sentry/tasks/{category}.py`
2. Use `@instrumented_task` decorator
3. Set appropriate `queue` and `max_retries`
4. Test location: `tests/sentry/tasks/test_{category}.py`

### Serializers: Avoiding N+1 Queries

NEVER query the database in `serialize()` for bulk requests. `serialize()` runs once per object, so per-object queries are N+1. Do all bulk queries once in `get_attrs()` (call `super().get_attrs()` first when extending), and have `serialize()` read only from `attrs`. For worked examples and other N+1 patterns, use the **`django-perf-review`** skill.

## API Development

### API Documentation

- OpenAPI spec generation: `make build-api-docs`
- API ownership tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`
- Documenting/typing an endpoint → use the **`document-api-endpoint`** skill.

### API Design Rules

1. Route: `/api/0/organizations/{org}/projects/{project}/`
2. Use `snake_case` for URL params
3. Use `camelCase` for request/response bodies
4. Return strings for numeric IDs
5. Implement pagination with `cursor`
6. Use `GET` for read, `POST` for create, `PUT` for update
7. **Error responses MUST use the `"detail"` key** (Django REST Framework convention) — not `"error"` or `"message"`:
   `return Response({"detail": "Invalid input"}, status=400)`.

## Common Patterns

### Feature Flags

See the **feature-flags** skill (`.agents/skills/feature-flags/`) for registration, the `features.has(...)` check, and test usage.

### Permissions

```python
from sentry.api.permissions import SentryPermission

class MyPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:write'],
    }
```

### Logging, Tracing, Metrics, Options

Logging (`logger.info/exception`, `LOG005`/`LOG011`), tracing/spans (`sentry.utils.tracing`), metrics tag cardinality, and the options system (`options.get()`) → use the **`backend-conventions`** skill.

## Architecture Rules

### Silo Mode

- **Control Silo**: User auth, billing, organization management
- **Region Silo**: Project data, events, issues
- Check model's silo in `src/sentry/models/outbox.py`; use `@cell_silo_endpoint` or `@control_silo_endpoint`.
- Never join across silos; use `outbox` for cross-silo updates. For silo/RPC/outbox work, use the **`hybrid-cloud-rpc`**, **`hybrid-cloud-outboxes`**, and **`cell-architecture`** skills.

### Database Guidelines

1. Migrations must be backwards compatible → use the **`generate-migration`** skill.
2. Add indexes for queries on 1M+ row tables (`db_index=True` or `db_index_together`).
3. **Composite indexes**: any query filtering multiple columns (e.g. `foreign_key_id__in=... AND id__gt=...`, or FK + timestamp range, or cursor pagination combining filters) needs an explicit `Index(fields=[...])` in `Meta.indexes`, ordered most-selective-first. A single FK auto-index does NOT cover multi-column filters. See **`django-perf-review`** for validation.

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

- **Models**: `src/sentry/models/{model}.py`
- **API Endpoints**: `src/sentry/api/endpoints/{resource}.py`
- **Serializers**: `src/sentry/api/serializers/models/{model}.py`
- **Tasks**: `src/sentry/tasks/{category}.py`
- **Integrations**: `src/sentry/integrations/{provider}/`
- **Permissions**: `src/sentry/api/permissions.py`
- **Feature Flags**: `src/sentry/features/permanent.py` or `temporary.py`
- **Utils**: `src/sentry/utils/{category}.py`

## Integration Development

Add an integration under `src/sentry/integrations/{name}/` with `__init__.py`, `integration.py` (inherit from `Integration`), `client.py` (API client), and `webhooks/` if needed. Register it in `src/sentry/integrations/registry.py` and add a feature flag in `temporary.py`.

## Python Typing

Use abstract types for input parameters (e.g. `Sequence` over `list`) and specific return types (e.g. `list` over `Sequence`). Import from `collections.abc`, not `typing`, when available (`from collections.abc import Sequence`).

```python
# Good: Abstract input types, specific return types
def process_items(items: Sequence[Item]) -> list[ProcessedItem]:
    return [process(item) for item in items]
```
