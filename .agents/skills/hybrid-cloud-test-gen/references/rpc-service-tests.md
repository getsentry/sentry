# RPC Service Test Reference

For comprehensive RPC service testing guidance — silo compatibility, serialization round-trips, field accuracy, cross-silo effects, and error handling — see the `hybrid-cloud-rpc` skill, **Step 7** (sections 7.1–7.6).

This file provides supplementary quick-reference patterns specific to test generation.

## Supplementary Import Block

These imports cover the full set needed across all RPC test patterns. Pick only what you need:

```python
import pytest
from unittest import mock

from sentry.hybridcloud.rpc.service import (
    dispatch_to_local_service,
    dispatch_remote_call,
    RpcDisabledException,
    RpcRemoteException,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import (
    all_silo_test,
    assume_test_silo_mode,
    assume_test_silo_mode_of,
    create_test_regions,
)
```

## Corrections to `hybrid-cloud-rpc` Step 7

The following patterns in the RPC skill's Step 7 should be applied with these adjustments:

1. **`TestCase` is sufficient for `outbox_runner()`** — only use `TransactionTestCase` when tests need real committed transactions (threading, concurrency).

2. **Never wrap factory calls in `assume_test_silo_mode`** — factories are silo-aware. Only wrap direct ORM queries (`Model.objects.get/filter/count/exists/delete`).

## Template: Composite RPC Test Class

Combines silo compat, field accuracy, serialization, and error handling in one class:

```python
@all_silo_test
class Test{ServiceName}Service(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def test_{method_name}_returns_result(self):
        result = {service_instance}.{method_name}(
            organization_id=self.organization.id,
        )
        assert result is not None
        assert result.{field} == expected_value

    def test_{method_name}_not_found_returns_none(self):
        result = {service_instance}.{method_name}(
            organization_id=self.organization.id,
            id=99999,
        )
        assert result is None

    def test_{method_name}_field_accuracy(self):
        orm_obj = {OrmModel}.objects.get(id=thing.id)
        rpc_obj = {service_instance}.{method_name}(
            organization_id=self.organization.id,
            id=orm_obj.id,
        )
        assert rpc_obj.id == orm_obj.id
        assert rpc_obj.name == orm_obj.name
        # ... compare every field

    def test_{method_name}_serialization_round_trip(self):
        serial_arguments = {
            "organization_id": self.organization.id,
        }
        result = dispatch_to_local_service(
            "{service_key}",
            "{method_name}",
            serial_arguments,
        )
        assert result["value"] is not None
```

## Template: Cross-Silo Effects with `assume_test_silo_mode_of`

Prefer `assume_test_silo_mode_of(Model)` over `assume_test_silo_mode(SiloMode.X)` when checking a single model:

```python
@all_silo_test(regions=create_test_regions("us"))
class Test{ServiceName}CrossSilo(TestCase, HybridCloudTestMixin):
    def test_{method_name}_creates_mapping(self):
        with outbox_runner():
            result = {service_instance}.{method_name}(
                organization_id=self.organization.id,
            )

        with assume_test_silo_mode_of({MappingModel}):
            mapping = {MappingModel}.objects.get(
                organization_id=self.organization.id,
            )
        assert result.slug == mapping.slug

    def test_{method_name}_triple_equality(self):
        rpc_result = {service_instance}.{method_name}(
            organization_id=self.organization.id,
        )
        with assume_test_silo_mode_of({OrmModel}):
            orm_obj = {OrmModel}.objects.get(id=rpc_result.id)
        with assume_test_silo_mode_of({MappingModel}):
            mapping = {MappingModel}.objects.get(
                organization_id=self.organization.id,
            )
        assert rpc_result.slug == orm_obj.slug == mapping.slug
```
