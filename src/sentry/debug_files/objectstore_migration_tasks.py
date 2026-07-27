from __future__ import annotations

import logging

from taskbroker_client.state import current_task

from sentry.debug_files.objectstore_migration import (
    ensure_migration_enabled,
    is_migration_killswitched,
    migrate_debug_file,
    shard_candidates,
)
from sentry.models.debugfile_migration import (
    DebugFileObjectstoreMigrationRun,
    DebugFileObjectstoreMigrationShard,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import debug_files_migration_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics

logger = logging.getLogger(__name__)

_SHARD_TASK_KEY = "debug_files_objectstore_migration_shard"
_QUERY_BATCH_SIZE = 20
_MAX_FILES_PER_ACTIVATION = 50


def _activation_id() -> str | None:
    task = current_task()
    return task.id if task else None


def enqueue_shard(run_id: int, shard_id: int) -> None:
    migrate_shard.apply_async(
        kwargs={"run_id": run_id, "shard_id": shard_id},
        headers={"sentry-propagate-traces": False},
    )


def enqueue_shard_heads(
    run: DebugFileObjectstoreMigrationRun,
    shard_ids: list[int] | None = None,
) -> int:
    """Enqueue one activation per shard. Worker pool size bounds concurrency."""
    ensure_migration_enabled()
    shards = run.shards.all().order_by("shard_id")
    if shard_ids is not None:
        shards = shards.filter(shard_id__in=shard_ids)
    count = 0
    for shard in shards:
        enqueue_shard(run.id, shard.shard_id)
        count += 1
    return count


@instrumented_task(
    name="sentry.debug_files.objectstore_migration.migrate_shard",
    namespace=debug_files_migration_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def migrate_shard(run_id: int, shard_id: int, **kwargs: object) -> None:
    ensure_migration_enabled()
    activation_id = _activation_id()
    if activation_id and already_spawned(_SHARD_TASK_KEY, activation_id):
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _SHARD_TASK_KEY},
        )
        return

    try:
        shard = DebugFileObjectstoreMigrationShard.objects.select_related("run").get(
            run_id=run_id, shard_id=shard_id
        )
    except DebugFileObjectstoreMigrationShard.DoesNotExist:
        logger.info(
            "debug_files.objectstore_migration.shard_missing",
            extra={"run_id": run_id, "shard_id": shard_id},
        )
        return

    processed = 0
    try:
        while processed < _MAX_FILES_PER_ACTIVATION:
            ensure_migration_enabled()
            candidates = list(shard_candidates(shard, limit=_QUERY_BATCH_SIZE))
            if not candidates:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra={
                        "run_id": run_id,
                        "shard_id": shard_id,
                        "cursor_id": shard.cursor_id,
                        "high_water_mark": shard.run.high_water_mark,
                    },
                )
                return

            hit_activation_limit = False
            for debug_file in candidates:
                ensure_migration_enabled()
                migrate_debug_file(
                    run_id=run_id,
                    shard_id=shard_id,
                    debug_file_id=debug_file.id,
                )
                processed += 1
                shard.cursor_id = debug_file.id
                if processed >= _MAX_FILES_PER_ACTIVATION:
                    hit_activation_limit = True
                    break

            logger.info(
                "debug_files.objectstore_migration.shard_progress",
                extra={
                    "run_id": run_id,
                    "shard_id": shard_id,
                    "cursor_id": shard.cursor_id,
                    "processed_this_activation": processed,
                    "high_water_mark": shard.run.high_water_mark,
                },
            )

            # Only treat a short batch as exhaustion when we consumed it fully.
            if hit_activation_limit:
                break
            if len(candidates) < _QUERY_BATCH_SIZE:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra={
                        "run_id": run_id,
                        "shard_id": shard_id,
                        "cursor_id": shard.cursor_id,
                        "high_water_mark": shard.run.high_water_mark,
                    },
                )
                return
    except Exception:
        logger.exception(
            "debug_files.objectstore_migration.shard_failed",
            extra={
                "run_id": run_id,
                "shard_id": shard_id,
                "cursor_id": shard.cursor_id,
            },
        )
        raise

    if is_migration_killswitched():
        raise RuntimeError("Debug file Objectstore migration is killswitched")

    enqueue_shard(run_id, shard_id)
    if activation_id:
        mark_spawned(_SHARD_TASK_KEY, activation_id)
