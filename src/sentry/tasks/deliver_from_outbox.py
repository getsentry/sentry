from __future__ import annotations

from django.conf import settings

from sentry.models import ControlOutboxBase, OutboxBase, RegionOutboxBase, outbox_silo_modes
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.enqueue_outbox_jobs")
def enqueue_outbox_jobs(**kwargs):
    processed: bool = False
    for silo_mode in outbox_silo_modes():
        for outbox_name in settings.SENTRY_OUTBOX_MODELS[silo_mode.name]:
            outbox_model = OutboxBase.from_outbox_name(outbox_name)

            for row in outbox_model.find_scheduled_shards():
                if next_outbox := outbox_model.prepare_next_from_shard(row):
                    processed = True
                    drain_outbox_shard.delay(
                        outbox_name=outbox_name,
                        **(next_outbox.key_from(outbox_model.sharding_columns)),
                    )

    return processed


@instrumented_task(name="sentry.tasks.drain_outbox_shard")
def drain_outbox_shard(
    shard_scope: int,
    shard_identifier: int,
    outbox_name: str | None = None,
    region_name: str | None = None,
):
    if region_name is not None:
        if outbox_name is None:
            outbox_name = settings.SENTRY_OUTBOX_MODELS["CONTROL"][0]

        outbox_model = ControlOutboxBase.from_outbox_name(outbox_name)

        shard_outbox = outbox_model(
            shard_scope=shard_scope, shard_identifier=shard_identifier, region_name=region_name
        )
    else:
        if outbox_name is None:
            outbox_name = settings.SENTRY_OUTBOX_MODELS["REGION"][0]

        outbox_model = RegionOutboxBase.from_outbox_name(outbox_name)

        shard_outbox = outbox_model(shard_scope=shard_scope, shard_identifier=shard_identifier)

    shard_outbox.drain_shard(flush_all=True)
