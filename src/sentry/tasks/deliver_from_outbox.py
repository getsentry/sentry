from __future__ import annotations

from sentry.models import ControlOutbox, RegionOutbox, outbox_silo_modes
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.enqueue_outbox_jobs")
def enqueue_outbox_jobs(**kwargs):
    processed: bool = False
    for silo_mode in outbox_silo_modes():
        outbox_model = RegionOutbox if silo_mode == SiloMode.REGION else ControlOutbox

        for row in outbox_model.find_scheduled_shards():
            if next_outbox := outbox_model.prepare_next_from_shard(row):
                processed = True
                drain_outbox_shard.delay(**(next_outbox.key_from(outbox_model.sharding_columns)))

    return processed


@instrumented_task(name="sentry.tasks.drain_outbox_shard")
def drain_outbox_shard(
    shard_scope: int,
    shard_identifier: int,
    region_name: str | None = None,
):
    if region_name is not None:
        shard_outbox = ControlOutbox(
            shard_scope=shard_scope, shard_identifier=shard_identifier, region_name=region_name
        )
    else:
        shard_outbox = RegionOutbox(shard_scope=shard_scope, shard_identifier=shard_identifier)

    shard_outbox.drain_shard(flush_all=True)
