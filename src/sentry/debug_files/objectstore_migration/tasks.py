from __future__ import annotations

import logging
from collections.abc import Mapping

from taskbroker_client.state import current_task

from sentry import options
from sentry.debug_files.objectstore_migration.utils import migrate_debug_file, shard_candidates
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import debug_files_migration_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Patched in tests; also the self-chain idempotency key.
_SHARD_TASK_KEY = "debug_files_objectstore_migration_shard"
_QUERY_BATCH_SIZE = 20
_MAX_FILES_PER_ACTIVATION = 50


def enqueue_shard(
    *,
    shard_id: int,
    num_shards: int,
    high_water_mark: int,
    cursor_id: int = 0,
) -> None:
    migrate_shard.apply_async(
        kwargs={
            "shard_id": shard_id,
            "num_shards": num_shards,
            "high_water_mark": high_water_mark,
            "cursor_id": cursor_id,
        },
        headers={"sentry-propagate-traces": False},
    )


def enqueue_shard_heads(
    *,
    num_shards: int,
    high_water_mark: int,
    cursors: Mapping[int, int] | None = None,
) -> int:
    """Enqueue shard head activations.

    ``cursors is None`` enqueues every shard at cursor 0. Otherwise only the
    shard ids present as keys are enqueued, each at its mapped cursor.
    """
    if options.get("debug-files.objectstore-migration.killswitch"):
        raise RuntimeError("Debug file Objectstore migration is killswitched")

    if cursors is None:
        targets: Mapping[int, int] = {shard_id: 0 for shard_id in range(num_shards)}
    else:
        targets = cursors

    count = 0
    for shard_id, cursor_id in targets.items():
        if shard_id < 0 or shard_id >= num_shards:
            raise ValueError(f"shard_id {shard_id} out of range for num_shards={num_shards}")
        enqueue_shard(
            shard_id=shard_id,
            num_shards=num_shards,
            high_water_mark=high_water_mark,
            cursor_id=cursor_id,
        )
        count += 1
    return count


@instrumented_task(
    name="sentry.debug_files.objectstore_migration.migrate_shard",
    namespace=debug_files_migration_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def migrate_shard(
    shard_id: int,
    num_shards: int,
    high_water_mark: int,
    cursor_id: int = 0,
    **kwargs: object,
) -> None:
    """Process one shard of DIFs, self-chaining with an advanced cursor_id.

    All campaign state lives in these kwargs — there is no DB run/shard table.
    Killswitch is checked once at task start (soft return, no self-chain).
    """
    if options.get("debug-files.objectstore-migration.killswitch"):
        logger.info(
            "debug_files.objectstore_migration.killswitched",
            extra={
                "shard_id": shard_id,
                "num_shards": num_shards,
                "cursor_id": cursor_id,
                "high_water_mark": high_water_mark,
            },
        )
        return

    task = current_task()
    activation_id = task.id if task else None
    if activation_id and already_spawned(_SHARD_TASK_KEY, activation_id):
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _SHARD_TASK_KEY},
        )
        return

    def log_extra(**extra: int) -> dict[str, int]:
        return {
            "shard_id": shard_id,
            "num_shards": num_shards,
            "cursor_id": cursor_id,
            "high_water_mark": high_water_mark,
            **extra,
        }

    processed = 0
    try:
        while processed < _MAX_FILES_PER_ACTIVATION:
            remaining = _MAX_FILES_PER_ACTIVATION - processed
            batch_limit = min(_QUERY_BATCH_SIZE, remaining)
            candidates = list(
                shard_candidates(
                    shard_id=shard_id,
                    num_shards=num_shards,
                    high_water_mark=high_water_mark,
                    cursor_id=cursor_id,
                    limit=batch_limit,
                )
            )
            if not candidates:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra=log_extra(),
                )
                return

            for debug_file in candidates:
                migrate_debug_file(debug_file_id=debug_file.id)
                processed += 1
                cursor_id = debug_file.id

            logger.info(
                "debug_files.objectstore_migration.shard_progress",
                extra=log_extra(processed_this_activation=processed),
            )

            # A short batch means we drained this shard; don't self-chain.
            if len(candidates) < batch_limit:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra=log_extra(),
                )
                return
    except Exception:
        logger.exception(
            "debug_files.objectstore_migration.shard_failed",
            extra=log_extra(),
        )
        raise

    enqueue_shard(
        shard_id=shard_id,
        num_shards=num_shards,
        high_water_mark=high_water_mark,
        cursor_id=cursor_id,
    )
    if activation_id:
        mark_spawned(_SHARD_TASK_KEY, activation_id)
