from __future__ import annotations

from typing import Callable

from django.conf import settings

from sentry.models import ControlOutboxBase, OutboxBase, RegionOutboxBase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.enqueue_outbox_jobs_control",
    queue="outbox.control",
    silo_mode=SiloMode.CONTROL,
)
def enqueue_outbox_jobs_control(**kwargs) -> bool:
    return _run_enqueue_outbox_jobs(
        silo_mode=SiloMode.CONTROL,
        drain_task=drain_outbox_shard_control,
    )


@instrumented_task(name="sentry.tasks.enqueue_outbox_jobs", silo_mode=SiloMode.REGION)
def enqueue_outbox_jobs(**kwargs) -> bool:
    return _run_enqueue_outbox_jobs(
        silo_mode=SiloMode.REGION,
        drain_task=drain_outbox_shard,
    )


def _run_enqueue_outbox_jobs(silo_mode: SiloMode, drain_task: Callable) -> bool:
    processed: bool = False
    for outbox_name in settings.SENTRY_OUTBOX_MODELS[silo_mode.name]:
        outbox_model = OutboxBase.from_outbox_name(outbox_name)

        for row in outbox_model.find_scheduled_shards():
            if next_outbox := outbox_model.prepare_next_from_shard(row):
                processed = True
                drain_task.delay(
                    outbox_name=outbox_name,
                    **(next_outbox.key_from(outbox_model.sharding_columns)),
                )

    return processed


@instrumented_task(
    name="sentry.tasks.drain_outbox_shard_control",
    queue="outbox.control",
    silo_mode=SiloMode.CONTROL,
)
def drain_outbox_shard_control(
    shard_scope: int,
    shard_identifier: int,
    outbox_name: str | None = None,
    region_name: str | None = None,
):
    assert region_name, "Cannot deliver outbox without a region name"
    if outbox_name is None:
        outbox_name = settings.SENTRY_OUTBOX_MODELS["CONTROL"][0]

    assert outbox_name, "Could not determine outbox name"
    outbox_model = ControlOutboxBase.from_outbox_name(outbox_name)

    shard_outbox = outbox_model(
        shard_scope=shard_scope, shard_identifier=shard_identifier, region_name=region_name
    )
    shard_outbox.drain_shard(flush_all=True)


@instrumented_task(name="sentry.tasks.drain_outbox_shard", silo_mode=SiloMode.REGION)
def drain_outbox_shard(
    shard_scope: int,
    shard_identifier: int,
    outbox_name: str | None = None,
    region_name: str | None = None,
):
    if outbox_name is None:
        outbox_name = settings.SENTRY_OUTBOX_MODELS["REGION"][0]

    assert outbox_name, "Could not determine outbox name"
    outbox_model = RegionOutboxBase.from_outbox_name(outbox_name)

    shard_outbox = outbox_model(shard_scope=shard_scope, shard_identifier=shard_identifier)
    shard_outbox.drain_shard(flush_all=True)
