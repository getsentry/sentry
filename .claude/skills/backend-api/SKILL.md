---
name: backend-api
description: Guidelines that should be followed when building a Django API route.
---

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

### Security Guidelines

#### Preventing Indirect Object References (IDOR)

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

### Permissions

```python
from sentry.api.permissions import SentryPermission

class MyPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:write'],
    }
```
