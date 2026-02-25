# Outbox Pattern Test Reference

> For outbox system architecture, model mixins, categories, signal receivers, and debugging,
> see the `hybrid-cloud-outboxes` skill. This reference covers test generation patterns only.

## Import Block

```python
from unittest.mock import Mock, call, patch

import pytest

from sentry.hybridcloud.models.outbox import (
    ControlOutbox,
    RegionOutbox,
    outbox_context,
)
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import (
    assume_test_silo_mode,
    assume_test_silo_mode_of,
    control_silo_test,
    region_silo_test,
)
```

## Template: Outbox Creation Verification

```python
@control_silo_test
class Test{Feature}Outbox(TestCase):

    def test_outbox_created_on_save(self):
        """Verify that saving a model creates the expected outbox record."""
        with outbox_context(flush=False):
            {Model}(id=10).outbox_for_update().save()

        assert {OutboxModel}.objects.count() == 1
        outbox = {OutboxModel}.objects.first()
        assert outbox.shard_scope == OutboxScope.{SCOPE}.value
        assert outbox.shard_identifier == 10
        assert outbox.category == OutboxCategory.{CATEGORY}.value

    def test_multiple_outboxes_created(self):
        """Verify multiple outbox records are created for batch operations."""
        with outbox_context(flush=False):
            {Model}(id=10).outbox_for_update().save()
            {Model}(id=20).outbox_for_update().save()

        assert {OutboxModel}.objects.count() == 2
```

## Template: Outbox Processing and Side Effects

```python
class Test{Feature}OutboxProcessing(TestCase):

    def test_outbox_drains_and_produces_side_effect(self):
        """Verify outbox processing produces the expected cross-silo effect."""
        # Create source objects using factories (no silo wrapper needed)
        org = self.create_organization()
        member = self.create_member(
            organization=org,
            user=self.create_user(),
        )

        # Drain outboxes
        with outbox_runner():
            pass

        # Verify cross-silo effect (silo wrapper needed for ORM query)
        with assume_test_silo_mode_of({ReplicaModel}):
            assert {ReplicaModel}.objects.filter(
                organization_id=org.id,
            ).exists()

    def test_outbox_drain_is_idempotent(self):
        """Verify draining the same shard twice produces no duplicates."""
        org = self.create_organization()

        with outbox_runner():
            pass

        with assume_test_silo_mode_of({ReplicaModel}):
            count_after_first = {ReplicaModel}.objects.count()

        # Drain again — should be a no-op
        with outbox_runner():
            pass

        with assume_test_silo_mode_of({ReplicaModel}):
            assert {ReplicaModel}.objects.count() == count_after_first
```

## Template: Outbox Signal Verification

```python
    @patch("sentry.hybridcloud.models.outbox.process_region_outbox.send")
    def test_outbox_sends_correct_signal(self, mock_send):
        """Verify the outbox signal fires with correct arguments."""
        org = self.create_organization()

        with outbox_context(flush=False):
            Organization(id=org.id).outbox_for_update().save()

        RegionOutbox.objects.filter(
            shard_identifier=org.id,
        ).first().drain_shard()

        mock_send.assert_called_with(
            sender=OutboxCategory.{CATEGORY},
            payload=None,
            object_identifier=org.id,
            shard_identifier=org.id,
            shard_scope=OutboxScope.{SCOPE},
        )
```

## Template: Shard Scheduling Verification

```python
    def test_scheduled_shards(self):
        """Verify correct shards are scheduled for processing."""
        org1 = self.create_organization()
        org2 = self.create_organization()

        with outbox_context(flush=False):
            Organization(id=org1.id).outbox_for_update().save()
            Organization(id=org2.id).outbox_for_update().save()

        shards = {
            (row["shard_scope"], row["shard_identifier"])
            for row in RegionOutbox.find_scheduled_shards()
        }
        assert shards == {
            (OutboxScope.ORGANIZATION_SCOPE.value, org1.id),
            (OutboxScope.ORGANIZATION_SCOPE.value, org2.id),
        }
```

## Template: Delete Propagation via Outbox

```python
    def test_delete_propagates_via_outbox(self):
        """Verify deleting an object propagates to the other silo via outbox."""
        # Create objects using factories (no silo wrapper needed)
        org = self.create_organization()
        member = self.create_member(
            organization=org,
            user=self.create_user(),
        )

        # Ensure mapping exists first
        with outbox_runner():
            pass
        with assume_test_silo_mode_of({MappingModel}):
            assert {MappingModel}.objects.filter(
                organizationmember_id=member.id,
            ).exists()

        # Delete and drain
        with outbox_runner():
            member.delete()

        # Verify mapping is gone
        with assume_test_silo_mode_of({MappingModel}):
            assert not {MappingModel}.objects.filter(
                organizationmember_id=member.id,
            ).exists()
```

## Key Patterns

- **`outbox_context(flush=False)`** creates outbox records without processing them. Use to verify outbox creation.
- **`outbox_runner()`** processes all pending outboxes synchronously. Works with `TestCase` — no need for `TransactionTestCase`.
- **`assume_test_silo_mode_of(Model)`** is preferred for checking a specific model's state cross-silo. Auto-detects the model's silo.
- **`assume_test_silo_mode(SiloMode.X)`** for blocks accessing multiple models or non-model resources.
- **Factory calls** (`self.create_organization()`, etc.) must NEVER be wrapped in `assume_test_silo_mode`. Factories handle silo mode internally.
- **`@control_silo_test`** for tests focused on `ControlOutbox` records. **`@region_silo_test`** for `RegionOutbox`.
- Only use **`TransactionTestCase`** for threading/concurrency tests (e.g., `threading.Barrier`), not for standard outbox drain tests.
- Outbox drain fixtures can clear state between tests:
  ```python
  @pytest.fixture(autouse=True, scope="function")
  def setup_clear_outbox():
      with outbox_runner():
          pass
  ```
