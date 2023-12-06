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
from django.db.models import Max, Min, Model

from sentry import options
from sentry.db.models.outboxes import ControlOutboxProducingModel, RegionOutboxProducingModel
from sentry.models.outbox import outbox_context
from sentry.models.user import User
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
    result: Tuple[int, int]
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        key = get_backfill_key(table_name)
        v = client.get(key)
        if v is None:
            result = (0, 1)
            client.set(key, json.dumps(result))
        else:
            lower, version = json.loads(v)
            if not (isinstance(lower, int) and isinstance(version, int)):
                raise TypeError("Expected processing data to be a tuple of (int, int)")
            result = lower, version
        metrics.gauge(
            "backfill_outboxes.low_bound",
            result[0],
            tags=dict(table_name=table_name, version=result[1]),
            sample_rate=1.0,
        )
        return result


def set_processing_state(table_name: str, value: int, version: int) -> None:
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        client.set(get_backfill_key(table_name), json.dumps((value, version)))
    metrics.gauge(
        "backfill_outboxes.low_bound",
        value,
        tags=dict(table_name=table_name, version=version),
    )


def find_replication_version(
    model: Union[Type[ControlOutboxProducingModel], Type[RegionOutboxProducingModel], Type[User]],
    force_synchronous=False,
) -> int:
    """
    :param model: Model for finding the current replication version
    :param force_synchronous:  when False, returns the min(options.get(version_key), model.replication_version), else
                                returns model.replication_version
                               For self hosted, this is generally True, so that we synchronously flush all replication
                               outboxes on every upgrade.  For SaaS, we wait for a sentry option to be set, bringing
                               the version up to the model.replication_version.
    """
    coded_version = model.replication_version
    if force_synchronous:
        return coded_version

    model_key = f"outbox_replication.{model._meta.db_table}.replication_version"
    return min(options.get(model_key), coded_version)


def _chunk_processing_batch(
    model: Union[Type[ControlOutboxProducingModel], Type[RegionOutboxProducingModel], Type[User]],
    *,
    batch_size: int,
    force_synchronous=False,
) -> BackfillBatch | None:
    lower, version = get_processing_state(model._meta.db_table)
    target_version = find_replication_version(model, force_synchronous=force_synchronous)
    if version > target_version:
        return None
    if version < target_version:
        lower = 0
        version = target_version
    lower = max(model.objects.aggregate(Min("id"))["id__min"] or 0, lower)
    upper = (
        model.objects.filter(id__gte=lower)
        .order_by("id")[: batch_size + 1]
        .aggregate(Max("id"))["id__max"]
        or 0
    )

    return BackfillBatch(low=lower, up=upper, version=version, has_more=upper > lower)


def process_outbox_backfill_batch(
    model: Type[Model], batch_size: int, force_synchronous=False
) -> BackfillBatch | None:
    if (
        not issubclass(model, RegionOutboxProducingModel)
        and not issubclass(model, ControlOutboxProducingModel)
        and not issubclass(model, User)
    ):
        return None

    processing_state = _chunk_processing_batch(
        model, batch_size=batch_size, force_synchronous=force_synchronous
    )
    if not processing_state:
        return None

    for inst in model.objects.filter(id__gte=processing_state.low, id__lte=processing_state.up):
        with outbox_context(transaction.atomic(router.db_for_write(model)), flush=False):
            if isinstance(inst, RegionOutboxProducingModel):
                inst.outbox_for_update().save()
            if isinstance(inst, ControlOutboxProducingModel) or isinstance(inst, User):
                for outbox in inst.outboxes_for_update():
                    outbox.save()

    if not processing_state.has_more:
        set_processing_state(model._meta.db_table, 0, model.replication_version + 1)
    else:
        set_processing_state(
            model._meta.db_table, processing_state.up + 1, processing_state.version
        )

    return processing_state


OUTBOX_BACKFILLS_PER_MINUTE = 10_000


def backfill_outboxes_for(
    silo_mode: SiloMode,
    scheduled_count: int = 0,
    max_batch_rate: int = OUTBOX_BACKFILLS_PER_MINUTE,
    force_synchronous=False,
) -> bool:
    # Maintain a steady state of outbox processing by subtracting any regularly scheduled rows
    # from an expected rate.
    remaining_to_backfill = max_batch_rate - scheduled_count
    backfilled = 0

    if remaining_to_backfill > 0:
        for app, app_models in apps.all_models.items():
            for model in app_models.values():
                if not hasattr(model._meta, "silo_limit"):
                    continue

                # Only process models local this operational mode.
                if (
                    silo_mode is not SiloMode.MONOLITH
                    and silo_mode not in model._meta.silo_limit.modes
                ):
                    continue

                # If we find some backfill work to perform, do it.
                batch = process_outbox_backfill_batch(
                    model, batch_size=remaining_to_backfill, force_synchronous=force_synchronous
                )
                if batch is None:
                    continue

                remaining_to_backfill -= batch.count
                backfilled += batch.count
                if remaining_to_backfill <= 0:
                    break

    metrics.incr(
        "backfill_outboxes.backfilled",
        amount=backfilled,
        tags=dict(silo_mode=silo_mode.name, force_synchronous=force_synchronous),
        skip_internal=True,
        sample_rate=1.0,
    )
    return backfilled > 0
