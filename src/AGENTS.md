# Backend Development Guide

> For setup, lint, and test commands, see the "Command Execution Guide" section in `/AGENTS.md` in the repository root.

## Security Guidelines

### Preventing Indirect Object References (IDOR)

Multi-tenant queries MUST be scoped. Never trust user-supplied IDs alone.

- Always filter by `organization_id` or `project_id`:
  `Resource.objects.get(id=..., organization_id=organization.id)`.
- Never read `request.data["project_id"]` or `request.GET["project_id"]` directly. Use `self.get_projects(request=request, organization=organization, project_ids=...)`, which checks permissions.

For access-control review or deeper authorization work, use the **`django-access-review`** and **`sentry-security`** skills.

## Development Services

`devservices` runs local dependencies from `devservices/config.yml`. Full documentation: https://develop.sentry.dev/development-infrastructure/devservices/

## AI Assistant Quick Decision Trees

### "User wants to add an API endpoint"

1. Check whether the endpoint already exists: `grep -rn "endpoint_name" src/sentry/`.
2. Inherit from the scope base: `OrganizationEndpoint` (`src/sentry/api/bases/organization.py`) or `ProjectEndpoint` (`src/sentry/api/bases/project.py`).
3. Decorate the class with `@cell_silo_endpoint` or `@control_silo_endpoint` from `src/sentry/api/base.py`.
4. Put the endpoint in the owning domain's `endpoints/` package (for example `src/sentry/core/endpoints/`) or in `src/sentry/api/endpoints/`. Register the route in `src/sentry/api/urls.py`, or in the domain `urls.py` it includes. The test file mirrors the endpoint path under `tests/`.
5. Document it with drf-spectacular decorators → use the **`document-api-endpoint`** skill.

### "User wants to add a task"

Tasks run on taskbroker, not Celery.

1. Decorate the function with `@instrumented_task` from `src/sentry/tasks/base.py`. Pass `name`, a `namespace` from `src/sentry/taskworker/namespaces.py`, and `retry=Retry(...)` from `taskbroker_client.retry` when the task retries.
2. Add a new task module to `TASKWORKER_IMPORTS` in `src/sentry/conf/server.py`. `tests/sentry/taskworker/test_config.py` fails when a listed path does not import.
3. The test file mirrors the module path under `tests/`.

Full documentation: https://develop.sentry.dev/backend/application-domains/tasks/

### Serializers: Avoiding N+1 Queries

NEVER query the database in `serialize()` for bulk requests. `serialize()` runs once per object, so per-object queries are N+1. Do all bulk queries once in `get_attrs()` (call `super().get_attrs()` first when extending), and have `serialize()` read only from `attrs`. For worked examples and other N+1 patterns, use the **`django-perf-review`** skill.

## API Development

### API Documentation

- Generate the OpenAPI spec with `make build-api-docs`.
- API ownership is tracked in `src/sentry/apidocs/api_ownership_allowlist_dont_modify.py`.

### API Design Rules

1. Route: `/api/0/organizations/{org}/projects/{project}/`
2. Use `snake_case` for URL params.
3. Use `camelCase` for request and response bodies.
4. Return strings for numeric IDs.
5. Paginate with `cursor`.
6. Use `GET` to read, `POST` to create, `PUT` to update.
7. **Error responses MUST use the `"detail"` key**, not `"error"` or `"message"`:
   `return Response({"detail": "Invalid input"}, status=400)`.

## Common Patterns

### Viewer/Organization Context

The `ViewerContext` contextvar carries the current viewer's identity. When the viewer is in scope, call `sentry.viewer_context.get_viewer_context()` instead of passing org and user identity through arguments.

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

Logging (`LOG005`, `LOG011`), spans, metric tag cardinality, and `options.get()` → use the **`backend-conventions`** skill.

## Architecture Rules

### Silo Mode

- The control silo holds global data such as `User`, `Integration`, and `OrganizationMapping`. The cell silo holds organization-scoped data such as `Organization`, `Project`, and `Group`.
- Each model declares its silo with `@control_silo_model` or `@cell_silo_model` (`src/sentry/db/models/base.py`). Each endpoint declares it with `@control_silo_endpoint` or `@cell_silo_endpoint`.
- Never join across silos. Use outboxes (`src/sentry/hybridcloud/models/outbox.py`) for cross-silo updates. For silo, RPC, and outbox work, use the **`hybrid-cloud-rpc`**, **`hybrid-cloud-outboxes`**, and **`cell-architecture`** skills.

### Database Guidelines

For new ORM model design, including primary keys and direct organization/project ownership, use the **`django-models`** skill (`.agents/skills/django-models/SKILL.md`).

1. Migrations must be backwards compatible → use the **`generate-migration`** skill.
2. Data migrations using `apps.get_model()` operate on historical model classes: custom `save()` methods are absent, and signals scoped to the live model class do not run. Identify and explicitly perform required side effects such as cache invalidation; see the **`generate-migration`** skill.
3. Add indexes for queries on 1M+ row tables (`db_index=True` or `db_index_together`).
4. **Composite indexes**: any query filtering multiple columns (e.g. `foreign_key_id__in=... AND id__gt=...`, or FK + timestamp range, or cursor pagination combining filters) needs an explicit `Index(fields=[...])` in `Meta.indexes`, ordered most-selective-first. A single FK auto-index does NOT cover multi-column filters. See **`django-perf-review`** for validation.

### Redis TTLs

**Every new Redis key sets a TTL, or is registered with Infrastructure Engineering as accepted durable data.** `CommonRedisCache.set` and `RedisKVStorage.set` raise `MissingTTL` for a key with no expiry, and there is no opt-out argument. Which commands drop an existing TTL, and why a sliding TTL is not a bound: https://develop.sentry.dev/backend/application-domains/redis/

## Anti-Patterns (NEVER DO)

```python
# WRONG: Slow external calls inside a request
response = requests.get(url)  # NO!

# RIGHT: Move the call into a task (see "User wants to add a task")
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

- **Models**: `src/sentry/models/{model}.py` or the owning domain's `models/` package
- **API Endpoints**: `src/sentry/api/endpoints/{resource}.py` or `src/sentry/{domain}/endpoints/`
- **Serializers**: `src/sentry/api/serializers/models/{model}.py`
- **Tasks**: `src/sentry/tasks/{category}.py` or `src/sentry/{domain}/tasks/`
- **Task namespaces**: `src/sentry/taskworker/namespaces.py`
- **Integrations**: `src/sentry/integrations/{provider}/`
- **Permissions**: `src/sentry/api/permissions.py`
- **Feature Flags**: `src/sentry/features/permanent.py` or `temporary.py`
- **Utils**: `src/sentry/utils/{category}.py`

## Integration Development

Add an integration under `src/sentry/integrations/{name}/`. Subclass `IntegrationProvider` and `IntegrationInstallation` from `src/sentry/integrations/base.py`; `src/sentry/integrations/example/integration.py` is a working reference. Register the provider class path in `SENTRY_DEFAULT_INTEGRATIONS` in `src/sentry/conf/server.py`, and gate it with a flag in `src/sentry/features/temporary.py`.

## Python Typing

Use abstract types for input parameters (e.g. `Sequence` over `list`) and specific return types (e.g. `list` over `Sequence`). Import from `collections.abc`, not `typing`, when available (`from collections.abc import Sequence`).

```python
# Good: Abstract input types, specific return types
def process_items(items: Sequence[Item]) -> list[ProcessedItem]:
    return [process(item) for item in items]
```
