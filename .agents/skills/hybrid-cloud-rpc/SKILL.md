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

### Error propagation

All errors an RPC method propagates must be done via the return type. Errors are
rewrapped and returned as generic Invalid service request to external callers.

```python
class RpcTentativeResult(RpcModel):
    success: bool
    error_str: str | None
    result: str | None

class DatabaseBackedMyService(MyService):
    def foobar(self, *, organization_id: int) -> RpcTentativeResult
        try:
            some_function_call()
        except e:
            return RpcTentativeResult(success=False, error_str = str(e))

        return RpcTentativeResult(success=True, result="foobar")
```

### RPC Models

Load `references/rpc-models.md` for supported types, default values, and serialization patterns.

## Step 5: Update Method Signatures

### Safe changes (backwards compatible)

- Adding a new **optional** parameter with a default value
- Widening a return type (e.g., `RpcFoo` → `RpcFoo | None`) on a Control RPC service
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

Every RPC service needs three categories of tests: **silo mode compatibility**, **data accuracy**, and **error handling**. Use `TransactionTestCase` (not `TestCase`) when tests need outbox processing or `on_commit` hooks.

### 7.1 Silo mode compatibility with `@all_silo_test`

Every service test class MUST use `@all_silo_test` so tests run in all three modes (MONOLITH, REGION, CONTROL). This ensures the delegation layer works for both local and remote dispatch paths.

```python
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions

@all_silo_test
class MyServiceTest(TestCase):
    def test_get_by_id(self):
        org = self.create_organization()
        result = my_service.get_by_id(organization_id=org.id, id=thing.id)
        assert result is not None
```

For tests that need named regions (e.g., testing region resolution):

```python
@all_silo_test(regions=create_test_regions("us", "eu"))
class MyServiceRegionTest(TransactionTestCase):
    ...
```

Use `assume_test_silo_mode` or `assume_test_silo_mode_of` to switch modes within a test when accessing ORM models that live in a different silo:

```python
def test_cross_silo_behavior(self):
    with assume_test_silo_mode(SiloMode.REGION):
        org = self.create_organization()
    result = my_service.get_by_id(organization_id=org.id, id=thing.id)
    assert result is not None
```

### 7.2 Serialization round-trip with `dispatch_to_local_service`

Test that arguments and return values survive serialization/deserialization:

```python
from sentry.hybridcloud.rpc.service import dispatch_to_local_service

def test_serialization_round_trip(self):
    result = dispatch_to_local_service(
        "my_service_key",
        "my_method",
        {"organization_id": org.id, "name": "test"},
    )
    assert result["value"] is not None
```

### 7.3 RPC model data accuracy

Validate that RPC models faithfully represent the ORM data. Compare **every field** of the RPC model against the source ORM object:

```python
def test_rpc_model_accuracy(self):
    orm_obj = MyModel.objects.get(id=thing.id)
    rpc_obj = my_service.get_by_id(organization_id=org.id, id=thing.id)

    assert rpc_obj.id == orm_obj.id
    assert rpc_obj.name == orm_obj.name
    assert rpc_obj.organization_id == orm_obj.organization_id
    assert rpc_obj.is_active == orm_obj.is_active
    assert rpc_obj.date_added == orm_obj.date_added
```

For models with flags or nested objects, iterate all field names:

```python
def test_flags_accuracy(self):
    rpc_org = organization_service.get(id=org.id)
    for field_name in rpc_org.flags.get_field_names():
        assert getattr(rpc_org.flags, field_name) == getattr(orm_org.flags, field_name)
```

For list results, sort both sides by ID before comparing:

```python
def test_list_accuracy(self):
    rpc_items = my_service.list_things(organization_id=org.id)
    orm_items = list(MyModel.objects.filter(organization_id=org.id).order_by("id"))
    assert len(rpc_items) == len(orm_items)
    for rpc_item, orm_item in zip(sorted(rpc_items, key=lambda x: x.id), orm_items):
        assert rpc_item.id == orm_item.id
        assert rpc_item.name == orm_item.name
```

### 7.4 Cross-silo resource creation

If your service creates or updates resources that propagate across silos (via outboxes or mappings), verify the cross-silo effects.

Use `outbox_runner()` to flush outboxes synchronously during tests:

```python
from sentry.testutils.outbox import outbox_runner

def test_cross_silo_mapping_created(self):
    with outbox_runner():
        my_service.create_thing(organization_id=org.id, name="test")

    with assume_test_silo_mode(SiloMode.CONTROL):
        mapping = MyMapping.objects.get(organization_id=org.id)
        assert mapping.name == "test"
```

For triple-equality assertions (RPC result = source ORM = cross-silo replica):

```python
def test_provisioning_accuracy(self):
    rpc_result = my_service.provision(organization_id=org.id, slug="test")
    with assume_test_silo_mode(SiloMode.REGION):
        orm_obj = MyModel.objects.get(id=rpc_result.id)
    with assume_test_silo_mode(SiloMode.CONTROL):
        mapping = MyMapping.objects.get(organization_id=org.id)
    assert rpc_result.slug == orm_obj.slug == mapping.slug
```

Use `HybridCloudTestMixin` for common cross-silo assertions:

```python
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin

class MyServiceTest(HybridCloudTestMixin, TransactionTestCase):
    def test_member_mapping_synced(self):
        self.assert_org_member_mapping(org_member=org_member)
```

### 7.5 Error handling

Test that the service handles errors correctly in all silo modes:

```python
def test_not_found_returns_none(self):
    result = my_service.get_by_id(organization_id=org.id, id=99999)
    assert result is None

def test_missing_org_returns_none(self):
    # For methods with return_none_if_mapping_not_found=True
    result = my_service.get_by_id(organization_id=99999, id=1)
    assert result is None
```

Test disabled methods:

```python
from sentry.hybridcloud.rpc.service import RpcDisabledException
from sentry.testutils.helpers.options import override_options

def test_disabled_method_raises(self):
    with override_options({"hybrid_cloud.rpc.disabled-service-methods": ["MyService.my_method"]}):
        with pytest.raises(RpcDisabledException):
            dispatch_remote_call(None, "my_service_key", "my_method", {"id": 1})
```

Test that remote exceptions are properly wrapped:

```python
from sentry.hybridcloud.rpc.service import RpcRemoteException

def test_remote_error_wrapping(self):
    if SiloMode.get_current_mode() == SiloMode.REGION:
        with pytest.raises(RpcRemoteException):
            my_control_service.do_thing_that_fails(...)
```

Test that failed operations produce no side effects:

```python
def test_no_side_effects_on_failure(self):
    result = my_service.create_conflicting_thing(organization_id=org.id)
    assert not result
    with assume_test_silo_mode(SiloMode.REGION):
        assert not MyModel.objects.filter(organization_id=org.id).exists()
```

Test that any calling code (both direct and indirect) is also appropriately
tested with the correct silo decorators.

### 7.6 Key imports for testing

```python
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.silo import (
    all_silo_test,
    control_silo_test,
    region_silo_test,
    assume_test_silo_mode,
    assume_test_silo_mode_of,
    create_test_regions,
)
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.hybridcloud.rpc.service import (
    dispatch_to_local_service,
    dispatch_remote_call,
    RpcDisabledException,
    RpcRemoteException,
)
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
- [ ] Tests use `@all_silo_test` for full silo mode coverage
- [ ] Tests validate RPC model field accuracy against ORM objects
- [ ] Tests verify cross-silo resources (mappings, replicas) are created with correct data
- [ ] Tests cover error cases (not found, disabled methods, failed operations)
- [ ] Tests cover serialization round-trip via `dispatch_to_local_service`
