from __future__ import annotations

from collections.abc import Mapping, Sequence

from sentry import options
from sentry.debug_files.objectstore_migration.utils import freeze_high_water_mark


def start_migration(
    *,
    shard_count: int,
    high_water_mark: int | None = None,
    cursors: Mapping[int, int] | None = None,
    shard_ids: Sequence[int] | None = None,
) -> int:
    """Freeze the high-water mark (unless provided) and enqueue shard heads.

    Progress lives only in task kwargs: each shard activation carries
    ``cursor_id`` and re-enqueues itself with an advanced cursor. Pass
    ``cursors`` / ``high_water_mark`` to resume a previous campaign from logs.
    """
    if options.get("debug-files.objectstore-migration.killswitch"):
        raise RuntimeError("Debug file Objectstore migration is killswitched")
    if shard_count < 1:
        raise ValueError("shard_count must be positive")

    # Lazy import: tasks import utils; avoid package import cycles at module load.
    from sentry.debug_files.objectstore_migration.tasks import enqueue_shard_heads

    if high_water_mark is None:
        high_water_mark = freeze_high_water_mark()

    return enqueue_shard_heads(
        shard_count=shard_count,
        high_water_mark=high_water_mark,
        cursors=cursors,
        shard_ids=shard_ids,
    )
