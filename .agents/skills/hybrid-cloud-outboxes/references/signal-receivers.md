# Signal Receiver Reference

## Overview

Manual signal receivers are used for `OutboxCategory` values that are **not** tied to a `ReplicatedRegionModel` or `ReplicatedControlModel`. The model mixins auto-connect receivers via `connect_region_model_updates()` / `connect_control_model_updates()` — you only write manual receivers for categories with custom dispatch logic.

**Source files**:

- `src/sentry/receivers/outbox/region.py` — region outbox receivers
- `src/sentry/receivers/outbox/control.py` — control outbox receivers
- `src/sentry/receivers/outbox/__init__.py` — `maybe_process_tombstone` helper

## Placement Rules

- **Region outbox receivers** go in `src/sentry/receivers/outbox/region.py` (or a new file under `src/sentry/receivers/outbox/`)
- **Control outbox receivers** go in `src/sentry/receivers/outbox/control.py` (or a new file under `src/sentry/receivers/outbox/`)
- Receivers must be imported at startup to register. Check that the receiver module is imported in `src/sentry/receivers/__init__.py` or a file that is.

## Region Outbox Receivers

Region outbox signals fire with these keyword arguments:

- `sender`: `OutboxCategory` enum value
- `payload`: `dict | None` — the JSON payload from the outbox
- `object_identifier`: `int` — the ID of the source object
- `shard_identifier`: `int` — the shard key (e.g., organization_id)
- `shard_scope`: `int` — the `OutboxScope` value

### Template: Payload-Only Receiver

For categories that carry all data in the payload (no DB lookup needed):

```python
from django.dispatch import receiver
from sentry.hybridcloud.outbox.signals import process_region_outbox
from sentry.hybridcloud.outbox.category import OutboxCategory


@receiver(process_region_outbox, sender=OutboxCategory.MY_CATEGORY)
def process_my_category(payload: Any, **kwds: Any) -> None:
    if payload is not None:
        my_rpc_service.do_something(data=MyRpcData(**payload))
```

### Template: Tombstone-Check Receiver

For categories tied to a model where you need to detect create/update vs delete:

```python
from django.dispatch import receiver
from sentry.hybridcloud.outbox.signals import process_region_outbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.receivers.outbox import maybe_process_tombstone


@receiver(process_region_outbox, sender=OutboxCategory.MY_CATEGORY)
def process_my_category(object_identifier: int, **kwds: Any) -> None:
    if (instance := maybe_process_tombstone(MyModel, object_identifier)) is None:
        return  # Object was deleted — tombstone recorded
    # Object exists — replicate
    my_rpc_service.sync(model_id=instance.id, data=serialize(instance))
```

### Template: Payload + Tombstone Receiver

When you need both the payload and a tombstone check:

```python
@receiver(process_region_outbox, sender=OutboxCategory.MY_CATEGORY)
def process_my_category(object_identifier: int, payload: Any, **kwds: Any) -> None:
    if (instance := maybe_process_tombstone(MyModel, object_identifier)) is None:
        return
    if payload and "extra_field" in payload:
        my_rpc_service.sync_with_extra(
            model_id=instance.id,
            extra_field=payload["extra_field"],
        )
```

## Control Outbox Receivers

Control outbox signals include an additional `region_name` argument:

- `sender`: `OutboxCategory` enum value
- `payload`: `dict | None`
- `object_identifier`: `int`
- `shard_identifier`: `int`
- `region_name`: `str` — the target region
- `shard_scope`: `int`
- `date_added`: `datetime`
- `scheduled_for`: `datetime`

### Template: Control Tombstone-Check Receiver

```python
from django.dispatch import receiver
from sentry.hybridcloud.outbox.signals import process_control_outbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.receivers.outbox import maybe_process_tombstone


@receiver(process_control_outbox, sender=OutboxCategory.MY_CATEGORY)
def process_my_category(object_identifier: int, region_name: str, **kwds: Any) -> None:
    if (instance := maybe_process_tombstone(
        MyModel, object_identifier, region_name=region_name
    )) is None:
        return
    # Replicate to the specific region
    my_region_service.sync(region_name=region_name, data=serialize(instance))
```

### Template: Control Pure-RPC Receiver

For categories where the receiver makes an RPC call without looking up a model:

```python
@receiver(process_control_outbox, sender=OutboxCategory.MY_CATEGORY)
def process_my_category(
    payload: Mapping[str, Any], shard_identifier: int, **kwds: Any
) -> None:
    my_region_service.do_something(
        organization_id=shard_identifier,
        data=payload["data"],
    )
```

## `maybe_process_tombstone` Pattern

```python
def maybe_process_tombstone(
    model: type[T],
    object_identifier: int,
    region_name: str | None = None,
) -> T | None:
```

This function:

1. Queries `model.objects.filter(id=object_identifier).last()`
2. If found: returns the instance (for replication)
3. If not found: records a tombstone via `region_tombstone_service` or `control_tombstone_service` and returns `None`

The tombstone system drives `HybridCloudForeignKey` cascade deletes across silos. When an object is deleted from one silo, the tombstone propagated to the other silo triggers cleanup of dependent records.

**When to use**: Any receiver that needs to distinguish between "object was created/updated" and "object was deleted". Not needed for payload-only categories (audit logs, IP events) where the payload carries all necessary data.

**`region_name` parameter**: Pass `region_name` for control outbox receivers (tombstone goes to the region). Omit for region outbox receivers (tombstone goes to control).
