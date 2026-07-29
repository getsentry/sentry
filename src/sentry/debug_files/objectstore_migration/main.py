from __future__ import annotations

from collections.abc import Mapping

from django.db.models import Max

from sentry import options
from sentry.models.debugfile import ProjectDebugFile


def start_migration(
    *,
    num_shards: int,
    cursors: Mapping[int, int] | None = None,
) -> None:
    """Start the migration of debug files to Objectstore.

    Progress lives only in task kwargs: each shard activation carries an
    inclusive ``cursor`` (the next id to start from) and re-enqueues itself
    with that cursor moved downward past the batch just processed.

    Args:
        num_shards: Number of partitions (``id % num_shards``).
        cursors: Optional map of ``shard_id -> cursor``. When omitted, every
            shard is enqueued at the current max id.
            When set, only the listed shards are enqueued (resume).
    """
    if not options.get("debug-files.objectstore-migration.enabled"):
        raise RuntimeError("Debug file Objectstore migration is killswitched")
    if num_shards < 1:
        raise ValueError("num_shards must be positive")

    from sentry.debug_files.objectstore_migration.tasks import enqueue_shard

    if cursors is None:
        start_cursor = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        targets: Mapping[int, int] = {shard_id: start_cursor for shard_id in range(num_shards)}
    else:
        targets = cursors

    if any(x < 0 or x >= num_shards for x in targets.keys()):
        raise ValueError("shard keys must be between 0 and num_shards - 1")

    for shard_id, cursor in targets.items():
        enqueue_shard(
            shard_id=shard_id,
            num_shards=num_shards,
            cursor=cursor,
        )
