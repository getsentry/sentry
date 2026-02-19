# Endpoint Security Patterns

## Contents

- Authorization flow
- Common IDOR patterns (with real examples)
- Base class requirements
- convert_args() scoping

## Authorization Flow

Every Sentry API request follows this flow:

```
dispatch() → initial() → request.access set → convert_args() → handler method
```

`convert_args()` resolves URL kwargs to objects AND runs permission checks via `check_object_permissions()`. The handler method receives pre-validated objects in kwargs.

## The #1 Vulnerability: Unscoped Object Lookups

The most common vulnerability is an endpoint that inherits `OrganizationEndpoint` (which gives it an `organization` object) but then queries a model using an ID from the request **without scoping by that organization**.

### Real Example: PromptsActivityEndpoint (PR #104990)

**Vulnerable code:**

```python
class PromptsActivityEndpoint(OrganizationEndpoint):
    def get(self, request: Request, **kwargs) -> Response:
        project_id = request.GET.get("project_id")
        # BUG: project_id from query param, not scoped by org
        result_qs = PromptsActivity.objects.filter(
            feature=feature, project_id=project_id, user_id=request.user.id
        )
```

**Fixed code:**

```python
class PromptsActivityEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization, **kwargs) -> Response:
        project_id = request.GET.get("project_id")
        # Validate project belongs to this org
        if not Project.objects.filter(id=project_id, organization_id=organization.id).exists():
            return Response({"detail": "Project not found"}, status=404)
        # Scope query by organization
        result_qs = PromptsActivity.objects.filter(
            feature=feature, project_id=project_id, user_id=request.user.id,
            organization_id=organization.id
        )
```

**Key tell:** The handler method did not accept `organization` as a parameter, meaning it never used the org from the URL.

### Real Example: OrganizationEventsEndpoint (PR #104987)

**Vulnerable code:**

```python
# DashboardWidget ID from query param, not scoped by org
widget = DashboardWidget.objects.get(id=widget_id)
```

**Fixed code:**

```python
widget = DashboardWidget.objects.get(
    id=widget_id,
    dashboard__organization_id=organization.id
)
```

### Real Example: conditionGroupId IDOR (PR #108156)

**Vulnerable code:**

```python
# condition_group_id from request body used directly
# Allowed injecting conditions from another org's workflow
class AbstractDataConditionValidator(serializers.Serializer):
    condition_group_id = serializers.IntegerField(required=False)
```

**Fixed code:**

```python
# Removed condition_group_id from user input entirely
# Server sets it in BaseDataConditionGroupValidator instead
class BaseDataConditionGroupValidator(serializers.Serializer):
    def validate(self, data):
        # Always set condition_group_id server-side
        data["condition_group_id"] = self.context["condition_group"].id
        return data
```

## Checklist for Endpoint Review

```
□ Handler method accepts organization/project from kwargs (not just **kwargs)
□ Every ID from request (query params, body, headers) is scoped:
  - By organization_id from URL, OR
  - By project_id that was itself scoped by org, OR
  - Via self.get_projects() which scopes internally
□ IDs from request body are not used to set foreign keys without validation
□ The endpoint's permission_classes match the sensitivity of the operation
□ For PUT/POST/DELETE: the object being modified is scoped by org/project
```

## Using self.get_projects()

When project IDs come from the request, always use `self.get_projects()`:

```python
# WRONG: Direct query bypasses permission checks
project = Project.objects.get(id=request.data["project_id"])

# RIGHT: Uses org-scoped permission-checked helper
projects = self.get_projects(
    request=request,
    organization=organization,
    project_ids={int(request.data["project_id"])}
)
```

`self.get_projects()` filters by `organization_id`, checks team membership, and validates the user can access the requested projects.

## Base Class Requirements

| Endpoint Type  | Base Class             | Provides                             | Permission Default                          |
| -------------- | ---------------------- | ------------------------------------ | ------------------------------------------- |
| Org-scoped     | `OrganizationEndpoint` | `organization` in kwargs             | `OrganizationPermission` (org:read for GET) |
| Project-scoped | `ProjectEndpoint`      | `organization` + `project` in kwargs | `ProjectPermission`                         |
| Region silo    | `RegionSiloEndpoint`   | Nothing — must implement own auth    | None                                        |
| Control silo   | `ControlSiloEndpoint`  | Nothing — must implement own auth    | None                                        |

If an endpoint inherits `RegionSiloEndpoint` or `Endpoint` directly instead of `OrganizationEndpoint`/`ProjectEndpoint`, verify it has its own authorization logic.
