from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence

from taskbroker_client.state import current_task

from sentry.debug_files.objectstore_migration import (
    ensure_migration_enabled,
    is_migration_killswitched,
    migrate_debug_file,
    shard_candidates,
)
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


def _soft_stop_if_killswitched(**extra: int) -> bool:
    """Log + True when killswitched. Worker tasks soft-stop (no raise, no self-chain)."""
    if not is_migration_killswitched():
        return False
    logger.info("debug_files.objectstore_migration.killswitched", extra=extra)
    return True


def enqueue_shard(
    *,
    shard_id: int,
    shard_count: int,
    high_water_mark: int,
    cursor_id: int = 0,
) -> None:
    migrate_shard.apply_async(
        kwargs={
            "shard_id": shard_id,
            "shard_count": shard_count,
            "high_water_mark": high_water_mark,
            "cursor_id": cursor_id,
        },
        headers={"sentry-propagate-traces": False},
    )


def enqueue_shard_heads(
    *,
    shard_count: int,
    high_water_mark: int,
    cursors: Mapping[int, int] | None = None,
    shard_ids: Sequence[int] | None = None,
) -> int:
    """Enqueue one activation per shard. Worker pool size bounds concurrency."""
    ensure_migration_enabled()
    targets = range(shard_count) if shard_ids is None else shard_ids
    count = 0
    for shard_id in targets:
        if shard_id < 0 or shard_id >= shard_count:
            raise ValueError(f"shard_id {shard_id} out of range for shard_count={shard_count}")
        cursor_id = 0 if cursors is None else cursors.get(shard_id, 0)
        enqueue_shard(
            shard_id=shard_id,
            shard_count=shard_count,
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
    shard_count: int,
    high_water_mark: int,
    cursor_id: int = 0,
    **kwargs: object,
) -> None:
    """Process one shard of DIFs, self-chaining with an advanced cursor_id.

    All campaign state lives in these kwargs — there is no DB run/shard table.
    Killswitch soft-stops the worker (log + return, no self-chain, no raise) so
    taskworker does not retry failed activations. Operator entrypoints
    (``start_migration`` / ``enqueue_shard_heads``) still hard-fail via
    ``ensure_migration_enabled``.
    """
    if _soft_stop_if_killswitched(
        shard_id=shard_id,
        shard_count=shard_count,
        cursor_id=cursor_id,
        high_water_mark=high_water_mark,
    ):
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
            "shard_count": shard_count,
            "cursor_id": cursor_id,
            "high_water_mark": high_water_mark,
            **extra,
        }

    processed = 0
    try:
        while processed < _MAX_FILES_PER_ACTIVATION:
            if _soft_stop_if_killswitched(**log_extra()):
                return
            remaining = _MAX_FILES_PER_ACTIVATION - processed
            batch_limit = min(_QUERY_BATCH_SIZE, remaining)
            candidates = list(
                shard_candidates(
                    shard_id=shard_id,
                    shard_count=shard_count,
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
                if _soft_stop_if_killswitched(**log_extra()):
                    return
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

    if _soft_stop_if_killswitched(**log_extra()):
        return

    enqueue_shard(
        shard_id=shard_id,
        shard_count=shard_count,
        high_water_mark=high_water_mark,
        cursor_id=cursor_id,
    )
    if activation_id:
        mark_spawned(_SHARD_TASK_KEY, activation_id)
