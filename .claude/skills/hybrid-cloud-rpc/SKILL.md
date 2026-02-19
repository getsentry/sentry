---
name: hybrid-cloud-rpc
description: Guide for creating, updating, and deprecating hybrid cloud RPC services in Sentry. Use when asked to "add RPC method", "create RPC service", "hybrid cloud service", "new RPC model", "deprecate RPC method", "remove RPC endpoint", "cross-silo service", "regional RPC", or "control silo service". Covers service scaffolding, method signatures, RPC models, region resolvers, testing, and safe deprecation workflows.
---

# Hybrid Cloud RPC Services

This skill guides you through creating, modifying, and deprecating RPC services in Sentry's hybrid cloud architecture. RPC services enable cross-silo communication between the Control silo (user auth, billing, org management) and Region silos (project data, events, issues).

## Critical Constraints

> **NEVER** use `from __future__ import annotations` in `service.py` or `model.py` files.
> The RPC framework reflects on type annotations at import time. Forward references break serialization silently.

> **ALL** RPC method parameters must be keyword-only (use `*` in the signature).

> **ALL** parameters and return types must have full type annotations — no string forward references.

> **ONLY** serializable types are allowed: `int`, `str`, `bool`, `float`, `None`, `Optional[T]`, `list[T]`, `dict[str, T]`, `RpcModel` subclasses, `Enum` subclasses, `datetime.datetime`.

> The service **MUST** live in one of the 12 registered discovery packages (see Step 3).

> Use `Field(repr=False)` on sensitive fields (tokens, secrets, keys, config blobs,
> metadata dicts) to prevent them from leaking into logs and error reports.
> See `references/rpc-models.md` for the full guide.

## Step 1: Determine Operation

Classify what the developer needs:

| Intent                                | Go to               |
| ------------------------------------- | ------------------- |
| Create a brand-new RPC service        | Step 2, then Step 3 |
| Add a method to an existing service   | Step 2, then Step 4 |
| Update an existing method's signature | Step 5              |
| Deprecate or remove a method/service  | Step 6              |

## Step 2: Determine Silo Mode

The service's `local_mode` determines where the database-backed implementation runs:

| Data lives in...                                  | `local_mode`       | Decorator on methods                | Example                            |
| ------------------------------------------------- | ------------------ | ----------------------------------- | ---------------------------------- |
| Region silo (projects, events, issues, org data)  | `SiloMode.REGION`  | `@regional_rpc_method(resolve=...)` | `OrganizationService`              |
| Control silo (users, auth, billing, org mappings) | `SiloMode.CONTROL` | `@rpc_method`                       | `OrganizationMemberMappingService` |

**Decision rule**: If the Django models you need to query live in the region database, use `SiloMode.REGION`. If they live in the control database, use `SiloMode.CONTROL`.

Region-silo services require a `RegionResolutionStrategy` on every RPC method so the framework knows which region to route remote calls to. Load `references/resolvers.md` for the full resolver table.

## Step 3: Create a New Service

Load `references/service-template.md` for copy-paste file templates.

### Directory structure

```
src/sentry/{domain}/services/{service_name}/
├── __init__.py      # Re-exports model and service
├── model.py         # RpcModel subclasses (NO future annotations)
├── serial.py        # ORM → RpcModel conversion functions
├── service.py       # Abstract service class (NO future annotations)
└── impl.py          # DatabaseBacked implementation
```

### Registration

The service package MUST be a sub-package of one of these 12 registered discovery packages:

```
sentry.auth.services
sentry.audit_log.services
sentry.backup.services
sentry.hybridcloud.services
sentry.identity.services
sentry.integrations.services
sentry.issues.services
sentry.notifications.services
sentry.organizations.services
sentry.projects.services
sentry.sentry_apps.services
sentry.users.services
```

If your service doesn't fit any of these, add a new entry to the `service_packages` tuple in `src/sentry/hybridcloud/rpc/service.py:list_all_service_method_signatures()`.

### Checklist for new services

- [ ] `key` is unique across all services (check existing keys with `grep -r 'key = "' src/sentry/*/services/*/service.py`)
- [ ] `local_mode` matches where the data lives
- [ ] `get_local_implementation()` returns the `DatabaseBacked` subclass
- [ ] Module-level `my_service = MyService.create_delegation()` at bottom of `service.py`
- [ ] `__init__.py` re-exports models and service
- [ ] No `from __future__ import annotations` in `service.py` or `model.py`

## Step 4: Add or Update Methods

### For REGION silo services

Load `references/resolvers.md` for resolver details.

```python
@regional_rpc_method(resolve=ByOrganizationId())
@abstractmethod
def my_method(
    self,
    *,
    organization_id: int,
    name: str,
    options: RpcMyOptions | None = None,
) -> RpcMyResult | None:
    pass
```

Key rules:

- `@regional_rpc_method` MUST come before `@abstractmethod`
- The resolver parameter (e.g., `organization_id`) MUST be in the method signature
- Use `return_none_if_mapping_not_found=True` when the return type is `Optional` and a missing org mapping means "not found" rather than an error

### For CONTROL silo services

```python
@rpc_method
@abstractmethod
def my_method(
    self,
    *,
    user_id: int,
    data: RpcMyData,
) -> RpcMyResult:
    pass
```

### Non-abstract convenience methods

You can also add non-abstract methods that compose other RPC calls. These run locally and are NOT exposed as RPC endpoints:

```python
def get_by_slug_or_id(self, *, slug: str | None = None, id: int | None = None) -> RpcThing | None:
    if slug:
        return self.get_by_slug(slug=slug)
    if id:
        return self.get_by_id(id=id)
    return None
```

### Implementation in impl.py

The `DatabaseBacked` subclass must implement every `@abstractmethod` with the exact same parameter names:

```python
class DatabaseBackedMyService(MyService):
    def my_method(self, *, organization_id: int, name: str, options: RpcMyOptions | None = None) -> RpcMyResult | None:
        # ORM queries here
        obj = MyModel.objects.filter(organization_id=organization_id, name=name).first()
        if obj is None:
            return None
        return serialize_my_model(obj)
```

### RPC Models

Load `references/rpc-models.md` for supported types, default values, and serialization patterns.

## Step 5: Update Method Signatures

### Safe changes (backwards compatible)

- Adding a new **optional** parameter with a default value
- Widening a return type (e.g., `RpcFoo` → `RpcFoo | None`)
- Adding fields with defaults to an `RpcModel`

### Breaking changes (require coordination)

- Removing or renaming a parameter
- Changing a parameter's type
- Narrowing a return type
- Removing fields from an `RpcModel`

For breaking changes, use a two-phase approach:

1. Add the new method alongside the old one
2. Migrate all callers to the new method
3. Remove the old method (see Step 6)

## Step 6: Deprecate or Remove

Load `references/deprecation.md` for the full 3-phase workflow.

**Quick summary**: Disable at runtime → migrate callers → remove code.

## Step 7: Test

### Testing with `dispatch_to_local_service`

Test serialization round-trip by calling through the RPC dispatch layer:

```python
from sentry.hybridcloud.rpc.service import dispatch_to_local_service

result = dispatch_to_local_service(
    "my_service_key",
    "my_method",
    {"organization_id": org.id, "name": "test"},
)
```

### Testing with `dispatch_remote_call`

For integration tests that verify the full remote call path (test client mode):

```python
from sentry.hybridcloud.rpc.service import dispatch_remote_call

result = dispatch_remote_call(
    region=None,  # None for control silo services
    service_name="my_service_key",
    method_name="my_method",
    serial_arguments={"user_id": user.id},
    use_test_client=True,
)
```

### Standard unit tests

```python
from sentry.myservice.services.myservice.service import my_service

class TestMyService(TestCase):
    def test_my_method(self):
        # Setup
        org = self.create_organization()
        # Call through the delegation layer
        result = my_service.my_method(organization_id=org.id, name="test")
        assert result is not None
        assert result.name == "test"
```

## Step 8: Verify (Pre-flight Checklist)

Before submitting your PR, verify:

- [ ] No `from __future__ import annotations` in service.py or model.py
- [ ] All RPC method parameters are keyword-only (`*` separator)
- [ ] All parameters have explicit type annotations
- [ ] All types are serializable (primitives, RpcModel, list, Optional, dict, Enum, datetime)
- [ ] Region service methods have `@regional_rpc_method` with appropriate resolver
- [ ] Control service methods have `@rpc_method`
- [ ] `@regional_rpc_method` / `@rpc_method` comes BEFORE `@abstractmethod`
- [ ] `create_delegation()` is called at module level at the bottom of service.py
- [ ] Service package is under one of the 12 registered discovery packages
- [ ] `impl.py` implements every abstract method with matching parameter names
- [ ] `serial.py` correctly converts ORM models to RPC models
- [ ] Sensitive fields use `Field(repr=False)` (tokens, secrets, config, metadata)
- [ ] Tests cover serialization round-trip via `dispatch_to_local_service`
