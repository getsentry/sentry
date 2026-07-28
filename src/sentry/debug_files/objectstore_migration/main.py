from __future__ import annotations

from collections.abc import Mapping

from sentry import options
from sentry.debug_files.objectstore_migration.utils import freeze_high_water_mark


def start_migration(
    *,
    num_shards: int,
    high_water_mark: int | None = None,
    cursors: Mapping[int, int] | None = None,
) -> int:
    """Freeze the high-water mark (unless provided) and enqueue shard heads.

    Progress lives only in task kwargs: each shard activation carries
    ``cursor_id`` and re-enqueues itself with an advanced cursor.

    - ``cursors is None``: start from scratch — enqueue every shard ``0..num_shards-1``
      at cursor ``0``.
    - ``cursors`` set: resume only those shard ids, each at the given cursor
      (e.g. ``{3: 1200, 5: 800}`` restarts just shards 3 and 5).
    """
    if options.get("debug-files.objectstore-migration.killswitch"):
        raise RuntimeError("Debug file Objectstore migration is killswitched")
    if num_shards < 1:
        raise ValueError("num_shards must be positive")

    from sentry.debug_files.objectstore_migration.tasks import enqueue_shard_heads

    if high_water_mark is None:
        high_water_mark = freeze_high_water_mark()

    return enqueue_shard_heads(
        num_shards=num_shards,
        high_water_mark=high_water_mark,
        cursors=cursors,
    )
