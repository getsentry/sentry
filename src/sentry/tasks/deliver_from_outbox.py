from __future__ import annotations

from typing import Any, Mapping, Type

from sentry.models import ControlOutbox, OutboxBase, RegionOutbox, outbox_silo_modes
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.types.region import MONOLITH_REGION_NAME


@instrumented_task(name="sentry.tasks.enqueue_outbox_jobs")
def enqueue_outbox_jobs(**kwargs):
    for silo_mode in outbox_silo_modes():
        outbox_model: Type[OutboxBase] = (
            RegionOutbox if silo_mode == SiloMode.REGION else ControlOutbox
        )

        row: Mapping[str, Any]
        for row in outbox_model.find_scheduled_shards():
            if next_outbox := outbox_model.prepare_next_from_shard(row):
                drain_outbox_shard.delay(**(next_outbox.key_from(outbox_model.sharding_columns)))


@instrumented_task(name="sentry.tasks.drain_outbox_shard")
def drain_outbox_shard(
    shard_scope: int,
    shard_identifier: int,
    region_name: str | None = None,
):
    if region_name is not None and region_name != MONOLITH_REGION_NAME:
        raise NotImplementedError(
            "System is not prepared to run in silo mode!  RPC client implementation required."
        )

    shard_outbox: OutboxBase
    if region_name is not None:
        shard_outbox = ControlOutbox(
            shard_scope=shard_scope, shard_identifier=shard_identifier, region_name=region_name
        )
    else:
        shard_outbox = RegionOutbox(shard_scope=shard_scope, shard_identifier=shard_identifier)

    shard_outbox.drain_shard()
