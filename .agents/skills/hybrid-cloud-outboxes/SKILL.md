---
name: hybrid-cloud-outboxes
description: >-
  Guide for creating and maintaining outbox-based eventually consistent operations
  in Sentry. Most commonly used for cross-silo data replication, but applicable
  anywhere eventual consistency is needed — including single-silo deferred side
  effects, audit logging, and event fanout. Use when asked to "add outbox",
  "add outbox replication", "replicate model to control silo", "replicate model
  to region", "add outbox category", "write outbox signal receiver", "debug stuck
  outboxes", "outbox not processing", "data not replicating", "test outbox",
  "migrate model to use outboxes", "backfill outbox data", "outbox coalescing",
  "ReplicatedRegionModel", "ReplicatedControlModel", "OutboxCategory",
  "OutboxScope", or "outbox_runner". Covers model mixins, category registration,
  signal receivers, testing, backfill, and debugging workflows.
---

# Hybrid Cloud Outboxes

Sentry uses a **transactional outbox pattern** for eventually consistent operations. When a model changes, an outbox row is written inside the same database transaction. After the transaction commits, the outbox is drained — firing a signal that triggers side effects such as RPC calls, tombstone propagation, or audit logging.

The most common use case is **cross-silo data replication**: a model saved in the Region silo produces a `RegionOutbox` that, when processed, replicates data to the Control silo (or vice versa via `ControlOutbox`). But the pattern is general — outboxes work for any operation that should happen reliably after a transaction commits, even within a single silo.

There are two outbox types corresponding to the two directions of flow:

- **`RegionOutbox`** — written in a Region silo, processed in the Region silo to push data toward Control (via RPC calls in signal receivers).
- **`ControlOutbox`** — written in the Control silo, processed in the Control silo to push data toward one or more Region silos. Each `ControlOutbox` row targets a specific `region_name`.

## Critical Constraints

> **Outboxes MUST be written in the same transaction as the data change.**
> The mixin classes (`ReplicatedRegionModel`, `ReplicatedControlModel`) enforce this automatically via `prepare_outboxes()`. If you write outboxes manually, always use `outbox_context(transaction.atomic(...))`.

> **Handlers MUST be idempotent.**
> Outboxes can be retried on failure and are coalesced — the handler may receive only the latest version of a change, or be called multiple times for the same change.

> **`drain_shard()` MUST NOT run inside a transaction.**
> It acquires `SELECT FOR UPDATE` locks and processes messages one at a time. Calling it inside a transaction will deadlock or hold locks for too long.

> **Only the latest payload survives coalescing.**
> Multiple outbox writes for the same `(scope, shard_identifier, category, object_identifier)` are coalesced — only the row with the highest ID is processed. Never rely on every intermediate payload being delivered.

> **Every `OutboxCategory` must be registered to exactly one `OutboxScope`.**
> An assertion at import time enforces this. A category registered to zero or multiple scopes causes an import crash.

> **Bulk operations must use the producing manager.**
> Use `MyModel.objects.bulk_create()` / `bulk_update()` / `bulk_delete()` from `RegionOutboxProducingManager` or `ControlOutboxProducingManager`. Raw querysets bypass outbox creation.

> **Snowflake ID models cannot use `bulk_create`.**
> The producing manager pre-allocates IDs via `SELECT nextval(...)`, which conflicts with snowflake ID generation. Use individual `save()` calls instead.

## Step 1: Determine What You Need

| Intent                                                      | Go to               |
| ----------------------------------------------------------- | ------------------- |
| Add outbox replication to a new model                       | Step 2              |
| Add a new `OutboxCategory` (not tied to a replicated model) | Step 3              |
| Write a manual signal receiver (not using model mixins)     | Step 4              |
| Migrate an existing model to use outboxes                   | Step 5, then Step 6 |
| Set up a backfill for existing data                         | Step 6              |
| Test outbox-based replication                               | Step 7              |
| Debug stuck or unprocessed outboxes                         | Step 8              |

## Step 2: Add Outbox Replication to a New Model

### 2.1 Choose the Mixin

| Data lives in... | Replicates toward... | Mixin                    | Outbox type     |
| ---------------- | -------------------- | ------------------------ | --------------- |
| Region silo      | Control silo         | `ReplicatedRegionModel`  | `RegionOutbox`  |
| Control silo     | Region silo(s)       | `ReplicatedControlModel` | `ControlOutbox` |

### 2.2 `ReplicatedRegionModel` Template

Use this when a Region model needs to replicate data to the Control silo.

```python
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.hybridcloud.outbox.base import ReplicatedRegionModel, RegionOutboxProducingManager
from sentry.hybridcloud.outbox.category import OutboxCategory


class MyModelManager(RegionOutboxProducingManager["MyModel"]):
    """Manager that ensures bulk operations create outboxes."""
    pass


@region_silo_model
class MyModel(ReplicatedRegionModel):
    __relocation_scope__ = RelocationScope.Organization

    # Required: the OutboxCategory for this model (must already be registered)
    category = OutboxCategory.MY_MODEL_UPDATE

    # Use the producing manager for bulk operation support
    objects: ClassVar[MyModelManager] = MyModelManager()

    # Model fields...
    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=128)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_mymodel"

    def payload_for_update(self) -> dict[str, Any] | None:
        """
        Optional: include data needed by the deletion handler.
        Keep payloads minimal — only data that cannot be recovered
        after the row is deleted. Payloads are coalesced (only the
        latest survives).
        """
        return None  # Override if needed

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        """
        Called when this object has been deleted (row no longer exists).
        Clean up cross-silo resources. Must be idempotent.
        """
        my_mapping_service.delete(
            my_model_id=identifier,
            organization_id=shard_identifier,
        )

    def handle_async_replication(self, shard_identifier: int) -> None:
        """
        Called when this object has been created or updated.
        Replicate to the control silo via RPC. Must be idempotent.
        """
        my_mapping_service.upsert(
            my_model_id=self.id,
            organization_id=shard_identifier,
            mapping=RpcMyModelMapping.from_orm(self),
        )
```

### 2.3 `ReplicatedControlModel` Template

Use this when a Control model needs to replicate data to Region silo(s). The key difference: Control outboxes fan out to one or more regions, so the model must declare which regions to target.

```python
from sentry.db.models import control_silo_model
from sentry.hybridcloud.outbox.base import ReplicatedControlModel, ControlOutboxProducingManager
from sentry.hybridcloud.outbox.category import OutboxCategory


class MyControlModelManager(ControlOutboxProducingManager["MyControlModel"]):
    pass


@control_silo_model
class MyControlModel(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global

    category = OutboxCategory.MY_CONTROL_MODEL_UPDATE

    objects: ClassVar[MyControlModelManager] = MyControlModelManager()

    # Model fields...
    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey("sentry.User")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_mycontrolmodel"

    def outbox_region_names(self) -> Collection[str]:
        """
        Which regions should receive outboxes for this change.
        Default implementation checks organization_id then user_id.
        Override for custom logic (e.g., all regions, specific regions).
        """
        # Default: auto-detects from organization_id or user_id attributes.
        # Override only if the default doesn't work for your model.
        return super().outbox_region_names()

    @classmethod
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        """Note: receives region_name — one call per target region."""
        pass

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        """Note: receives region_name — one call per target region."""
        pass
```

### 2.4 Wire Up the Category Connection

The mixin classes auto-connect signal receivers via `OutboxCategory.connect_region_model_updates()` (or `connect_control_model_updates()`). This happens at class definition time when the `category` class variable is set. The connection dispatches to your `handle_async_replication` and `handle_async_deletion` methods automatically.

**No manual signal receiver is needed** for replicated models — the mixin handles it. Manual receivers are only needed for categories that don't map to a replicated model (see Step 4).

If your `OutboxCategory` doesn't exist yet, create it first (Step 3).

## Step 3: Add a New OutboxCategory

Every outbox message type needs an `OutboxCategory` enum value registered to exactly one `OutboxScope`.

**Quick steps:**

1. Add a new value to the `OutboxCategory` enum in `src/sentry/hybridcloud/outbox/category.py`
2. Register it under the appropriate `OutboxScope` (determines the shard key)
3. If using model mixins, set `category = OutboxCategory.MY_CATEGORY` on the model

Load `references/category-and-scope.md` for the full scope-to-category mapping, how to pick a scope, and registration mechanics.

## Step 4: Write a Manual Signal Receiver

Use manual receivers when the outbox category is **not** tied to a `ReplicatedRegionModel` or `ReplicatedControlModel`. Common cases:

- Payload-only operations (audit logs, IP events) that carry all data in the payload
- Actions triggered by a model change but not replicating that model directly
- Cross-silo signal forwarding (`SEND_SIGNAL`, `RESET_IDP_FLAGS`)
- Complex multi-step operations requiring custom dispatch logic

Load `references/signal-receivers.md` for copy-paste receiver templates, the `maybe_process_tombstone` pattern, and placement rules.

## Step 5: Migrate an Existing Model to Use Outboxes

When adding outbox replication to a model that already has data in production:

### 5.1 Code Changes (Non-Breaking)

1. Change the model's base class to `ReplicatedRegionModel` or `ReplicatedControlModel`
2. Add the `category` class variable
3. Add a producing manager (`RegionOutboxProducingManager` / `ControlOutboxProducingManager`)
4. Implement `handle_async_replication` and `handle_async_deletion`
5. If needed, add `payload_for_update()` for deletion recovery data
6. Create the `OutboxCategory` if it doesn't exist (Step 3)

These changes are non-breaking: new model saves will create outboxes, but existing rows have no outboxes yet.

### 5.2 Backfill Existing Data

Existing rows need outboxes created retroactively. Set `replication_version = 2` (or higher) on the model class and configure the backfill system — see Step 6.

## Step 6: Set Up a Backfill

The backfill system creates outboxes for existing model rows that predate the outbox integration. It processes rows in batches, tracked via Redis state.

Load `references/backfill.md` for the `replication_version` mechanism, option key format, Redis state tracking, and SaaS vs self-hosted rollout procedures.

## Step 7: Test Outbox-Based Replication

> For detailed outbox test templates and copy-paste patterns, invoke the `hybrid-cloud-test-gen` skill.
> The guidance below covers what to test; `hybrid-cloud-test-gen` covers how to generate the test code.

### 7.1 Core Test Utilities

**`outbox_runner()`** — the primary test tool. Context manager that drains all pending outboxes synchronously after the wrapped code succeeds:

```python
from sentry.testutils.outbox import outbox_runner

with outbox_runner():
    my_model.save()
# All outboxes drained — cross-silo effects have happened
```

It runs up to 10 drain iterations (raises `OutboxRecursionLimitError` if exceeded). Works with `TestCase` — no `TransactionTestCase` needed for standard outbox tests.

**`outbox_context(flush=False)`** — creates outbox records without processing them. Use to verify outbox creation independently of processing:

```python
from sentry.hybridcloud.models.outbox import outbox_context

with outbox_context(flush=False):
    MyModel(id=10).outbox_for_update().save()

assert RegionOutbox.objects.count() == 1
```

**`assume_test_silo_mode` / `assume_test_silo_mode_of`** — switch silo context within a test to query cross-silo models:

```python
from sentry.testutils.silo import assume_test_silo_mode_of

with assume_test_silo_mode_of(MyMapping):
    assert MyMapping.objects.filter(my_model_id=obj.id).exists()
```

### 7.2 What to Test

**Outbox creation** — verify saving/deleting the model creates outbox rows with correct scope, category, and identifiers:

```python
def test_outbox_created_on_save(self):
    with outbox_context(flush=False):
        obj = MyModel(id=10, organization_id=1)
        obj.outbox_for_update().save()

    outbox = RegionOutbox.objects.first()
    assert outbox.category == OutboxCategory.MY_MODEL_UPDATE.value
    assert outbox.shard_scope == OutboxScope.ORGANIZATION_SCOPE.value
    assert outbox.shard_identifier == 1
```

**Replication propagates** — verify the full round-trip: save model -> drain outboxes -> cross-silo effect:

```python
def test_replication_creates_mapping(self):
    org = self.create_organization()
    with outbox_runner():
        obj = MyModel.objects.create(organization=org, name="test")

    with assume_test_silo_mode_of(MyMapping):
        mapping = MyMapping.objects.get(my_model_id=obj.id)
        assert mapping.name == "test"
```

**Deletion and tombstone** — verify deleting the model triggers `handle_async_deletion` and cleans up cross-silo resources:

```python
def test_delete_cleans_up_mapping(self):
    org = self.create_organization()
    with outbox_runner():
        obj = MyModel.objects.create(organization=org, name="test")

    with outbox_runner():
        obj.delete()

    with assume_test_silo_mode_of(MyMapping):
        assert not MyMapping.objects.filter(my_model_id=obj.id).exists()
```

**Idempotency** — verify draining the same shard twice produces no duplicates or errors:

```python
def test_idempotent_replication(self):
    with outbox_runner():
        obj = MyModel.objects.create(organization=org, name="test")

    with assume_test_silo_mode_of(MyMapping):
        count_after_first = MyMapping.objects.count()

    with outbox_runner():
        pass  # Drain again — should be a no-op

    with assume_test_silo_mode_of(MyMapping):
        assert MyMapping.objects.count() == count_after_first
```

### 7.3 Silo Test Decorators

- Use **`@region_silo_test`** for tests focused on `RegionOutbox` creation
- Use **`@control_silo_test`** for tests focused on `ControlOutbox` creation
- Use **`@all_silo_test`** for end-to-end replication tests that exercise both silos
- Only use **`TransactionTestCase`** for threading/concurrency tests (e.g., `threading.Barrier`), not for standard outbox drain tests

### 7.4 Common Pitfalls

- **Factory calls** (`self.create_organization()`, etc.) must NEVER be wrapped in `assume_test_silo_mode`. Factories handle silo mode internally.
- **`outbox_runner()`** clears outboxes on exit. If you need to inspect outbox state, use `outbox_context(flush=False)` instead.
- If an outbox handler creates more outboxes (cascading), `outbox_runner` handles this automatically (up to 10 iterations).

## Step 8: Debug Stuck Outboxes

| Symptom                                | Likely cause                                    | Investigation                                       |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Data not replicating to other silo     | Handler error, outbox in backoff                | Check `scheduled_for` on stuck outboxes             |
| `OutboxFlushError` in tests            | Signal receiver raises an exception             | Read the wrapped exception in the error message     |
| Outbox rows accumulating               | Drain task not running or failing               | Check Celery task logs for `enqueue_outbox_jobs`    |
| Shard draining slowly                  | Large coalesced batch or handler timeout        | Check `outbox.coalesced_net_processing_time` metric |
| Import crash: scope/category assertion | Category registered to wrong or multiple scopes | Check `OutboxScope` registration in `category.py`   |

Load `references/debugging.md` for the full processing pipeline walkthrough, shard inspection methods, backoff schedule, kill switches, and useful SQL/metrics queries.

## Step 9: Verify (Pre-flight Checklist)

Before submitting your PR, verify:

- [ ] Model inherits from `ReplicatedRegionModel` or `ReplicatedControlModel` (or uses manual receivers)
- [ ] `category` class variable is set to the correct `OutboxCategory`
- [ ] `OutboxCategory` is registered to exactly one `OutboxScope`
- [ ] The chosen `OutboxScope` matches the model's shard key (organization_id, user_id, etc.)
- [ ] `handle_async_replication` is idempotent (safe to call multiple times)
- [ ] `handle_async_deletion` is idempotent and handles the case where the row is already gone
- [ ] `payload_for_update()` includes only data needed for deletion recovery (not rapidly-changing fields)
- [ ] Producing manager (`RegionOutboxProducingManager` / `ControlOutboxProducingManager`) is set on the model
- [ ] Bulk operations go through the producing manager, not raw querysets
- [ ] `ReplicatedControlModel` has correct `outbox_region_names()` implementation
- [ ] Tests verify outbox creation (scope, category, identifiers)
- [ ] Tests verify end-to-end replication (save -> drain -> cross-silo effect)
- [ ] Tests verify deletion propagation (delete -> drain -> cleanup)
- [ ] Tests verify idempotency (drain twice -> no duplicates)
- [ ] If migrating an existing model, `replication_version` is bumped and backfill is configured
