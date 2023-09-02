"""
Checks OutboxProduciongModel classes and their __replication_version__.
When the replication_version on any class is bumped, this task queues up
outboxes for all the model instances of said class.

This helps keep replicated models replicated when logic or columns change over time.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Tuple, Type, Union

import sentry_sdk
from celery import Task
from django.apps import apps
from django.db import router, transaction
from django.db.models import Max

from sentry.db.models import BaseModel
from sentry.db.models.outboxes import ControlOutboxProducingModel, RegionOutboxProducingModel
from sentry.models import outbox_context
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis


@dataclass
class BackfillBatch:
    low: int
    up: int
    version: int
    has_more: bool


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
        tags=dict(table_name=table_name),
    )


def _chunk_processing_batch(
    model: Union[Type[ControlOutboxProducingModel], Type[RegionOutboxProducingModel]],
    *,
    batch_size: int,
) -> BackfillBatch | None:
    lower, version = get_processing_state(model._meta.db_table)
    if version > model.__replication_version__:
        return None
    if version < model.__replication_version__:
        lower = 0
        version = model.__replication_version__
    upper = model.objects.aggregate(Max("id"))["id__max"] or 0
    batch_upper = min(upper, lower + batch_size)

    # cap to batch size so that query timeouts don't get us.
    capped = upper
    if upper >= batch_upper:
        capped = batch_upper

    return BackfillBatch(low=lower, up=capped, version=version, has_more=upper > capped)


@instrumented_task(
    name="sentry.tasks.backfill_outboxes.schedule_backfill_outbox_jobs_control",
    queue="outbox.control",
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def schedule_backfill_outbox_jobs_control():
    _schedule_backfill_outboxes(ControlOutboxProducingModel, process_backfill_outboxes_control)


@instrumented_task(
    name="sentry.tasks.backfill_outboxes.schedule_backfill_outbox_jobs",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def schedule_hybrid_cloud_foreign_key_jobs():
    _schedule_backfill_outboxes(RegionOutboxProducingModel, process_backfill_outboxes)


def _schedule_backfill_outboxes(type: Type[BaseModel], backfill_task: Task) -> None:
    for app, app_models in apps.all_models.items():
        for model in app_models.values():
            if not issubclass(model, type):
                continue

            backfill_task.delay(
                app_name=app,
                model_name=model.__name__,
            )


@instrumented_task(
    name="sentry.tasks.backfill_outboxes.process_backfill_outboxes_control",
    queue="outbox.control",
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def process_backfill_outboxes_control(app_name: str, model_name: str) -> None:
    def make_outboxes(m: BaseModel):
        if isinstance(m, ControlOutboxProducingModel):
            for outbox in m.outboxes_for_update():
                outbox.save()

    _process_backfill(
        app_name=app_name,
        model_name=model_name,
        make_outboxes=make_outboxes,
        task=process_backfill_outboxes_control,
    )


@instrumented_task(
    name="sentry.tasks.backfill_outboxes.process_backfill_outboxes",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def process_backfill_outboxes(app_name: str, model_name: str) -> None:
    def make_outboxes(m: BaseModel):
        if isinstance(m, RegionOutboxProducingModel):
            m.outbox_for_update().save()

    _process_backfill(
        app_name=app_name,
        model_name=model_name,
        make_outboxes=make_outboxes,
        task=process_backfill_outboxes,
    )


def _process_backfill(
    app_name: str, model_name: str, make_outboxes: Callable[[BaseModel], None], task: Task
) -> None:
    try:
        model: Type[ControlOutboxProducingModel] = apps.get_model(
            app_label=app_name, model_name=model_name
        )
        if not issubclass(model, ControlOutboxProducingModel):
            return
        processing_state = _chunk_processing_batch(model, batch_size=get_batch_size())
        if not processing_state:
            return

        inst: ControlOutboxProducingModel
        for inst in model.objects.filter(id__gt=processing_state.low, id__lte=processing_state.up):
            with outbox_context(transaction.atomic(router.db_for_write(model)), flush=False):
                make_outboxes(inst)
                for outbox in inst.outboxes_for_update():
                    outbox.save()

        if not processing_state.has_more:
            set_processing_state(model._meta.db_table, 0, model.__replication_version__ + 1)
        else:
            set_processing_state(
                model._meta.db_table, processing_state.up, processing_state.version
            )
            task.apply_async(
                kwargs=dict(
                    app_name=app_name,
                    model_name=model_name,
                ),
                countdown=15,
            )

    except Exception:
        sentry_sdk.capture_exception()
        raise


def get_batch_size() -> int:
    return 500
