from __future__ import annotations

from collections.abc import Mapping

from django.db.models import Max

from sentry import options
from sentry.models.debugfile import ProjectDebugFile


def start_migration(
    *,
    num_shards: int,
    high_water_mark: int | None = None,
    cursors: Mapping[int, int] | None = None,
) -> None:
    """Freeze the high-water mark (unless provided) and enqueue shard heads.

    Progress lives only in task kwargs: each shard activation carries
    ``cursor`` and re-enqueues itself with an advanced cursor.

    Args:
        num_shards: Number of partitions (``id % num_shards``).
        high_water_mark: Inclusive upper bound on ``ProjectDebugFile.id``.
            Defaults to the current max id.
        cursors: Optional map of ``shard_id -> cursor``. When omitted, every
            shard is enqueued at cursor ``0``. When set, only the listed shards
            are enqueued.
    """
    if options.get("debug-files.objectstore-migration.killswitch"):
        raise RuntimeError("Debug file Objectstore migration is killswitched")
    if num_shards < 1:
        raise ValueError("num_shards must be positive")

    from sentry.debug_files.objectstore_migration.tasks import enqueue_shard

    if high_water_mark is None:
        high_water_mark = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0

    if cursors is None:
        targets: Mapping[int, int] = {shard_id: 0 for shard_id in range(num_shards)}
    else:
        targets = cursors

    if any(x < 0 or x >= num_shards for x in targets.keys()):
        raise ValueError("shard keys must be between 0 and num_shards - 1")

    for shard_id, cursor in targets.items():
        enqueue_shard(
            shard_id=shard_id,
            num_shards=num_shards,
            cursor=cursor,
            high_water_mark=high_water_mark,
        )
