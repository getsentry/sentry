"""
Checks OutboxProducingModel classes and their replication_version.
When the replication_version on any class is bumped, callers to process_outbox_backfill_batch
will produce new outboxes incrementally to replicate those models.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple, Type, Union

from django.apps import apps
from django.db import router, transaction
from django.db.models import Max

from sentry.db.models import Model
from sentry.db.models.outboxes import ControlOutboxProducingModel, RegionOutboxProducingModel
from sentry.models import outbox_context
from sentry.silo import SiloMode
from sentry.utils import json, metrics, redis


@dataclass
class BackfillBatch:
    low: int
    up: int
    version: int
    has_more: bool

    @property
    def count(self) -> int:
        return self.up - self.low + 1


def get_backfill_key(table_name: str) -> str:
    return f"outbox_backfill.{table_name}"


def get_processing_state(table_name: str) -> Tuple[int, int]:
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        key = get_backfill_key(table_name)
        v = client.get(key)
        if v is None:
            result = (0, 0)
            client.set(key, json.dumps(result))
            return result
        lower, version = json.loads(v)
        if not (isinstance(lower, int) and isinstance(version, int)):
            raise TypeError("Expected processing data to be a tuple of (int, int)")
        return lower, version


def set_processing_state(table_name: str, value: int, version: int) -> None:
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        client.set(get_backfill_key(table_name), json.dumps((value, version)))
    metrics.gauge(
        "backfill_outboxes.low_bound",
        value,
        tags=dict(table_name=table_name, version=version),
    )


def _chunk_processing_batch(
    model: Union[Type[ControlOutboxProducingModel], Type[RegionOutboxProducingModel]],
    *,
    batch_size: int,
) -> BackfillBatch | None:
    lower, version = get_processing_state(model._meta.db_table)
    if version > model.replication_version:
        return None
    if version < model.replication_version:
        lower = 0
        version = model.replication_version
    upper = model.objects.aggregate(Max("id"))["id__max"] or 0
    batch_upper = min(upper, lower + batch_size)

    # cap to batch size so that query timeouts don't get us.
    capped = upper
    if upper >= batch_upper:
        capped = batch_upper

    return BackfillBatch(low=lower, up=capped, version=version, has_more=upper > capped)


def process_outbox_backfill_batch(model: Type[Model], batch_size: int) -> BackfillBatch | None:
    if not issubclass(model, RegionOutboxProducingModel) and not issubclass(
        model, ControlOutboxProducingModel
    ):
        return None

    processing_state = _chunk_processing_batch(model, batch_size=batch_size)
    if not processing_state:
        return

    for inst in model.objects.filter(id__gt=processing_state.low, id__lte=processing_state.up):
        with outbox_context(transaction.atomic(router.db_for_write(model)), flush=False):
            if isinstance(inst, RegionOutboxProducingModel):
                inst.outbox_for_update().save()
            if isinstance(inst, ControlOutboxProducingModel):
                for outbox in inst.outboxes_for_update():
                    outbox.save()

    if not processing_state.has_more:
        set_processing_state(model._meta.db_table, 0, model.replication_version + 1)
    else:
        set_processing_state(model._meta.db_table, processing_state.up, processing_state.version)

    return processing_state


OUTBOX_BACKFILLS_PER_MINUTE = 10_000


def backfill_outboxes_for(
    silo_mode: SiloMode, scheduled_count: int, max_batch_rate: int = OUTBOX_BACKFILLS_PER_MINUTE
) -> bool:
    # Maintain a steady state of outbox processing by subtracting any regularly scheduled rows
    # from an expected rate.
    remaining_to_schedule = max_batch_rate - scheduled_count
    if remaining_to_schedule <= 0:
        return False

    for app, app_models in apps.all_models.items():
        for model in app_models.values():
            if not hasattr(model._meta, "silo_limit"):
                continue

            # Only process models local this operational mode.
            if silo_mode not in model._meta.silo_limit.modes:
                continue

            # If we find some backfill work to perform, do it.
            batch = process_outbox_backfill_batch(model, batch_size=remaining_to_schedule)
            if batch is None:
                continue

            remaining_to_schedule -= batch.count
            if remaining_to_schedule <= 0:
                break

    return remaining_to_schedule > 0
