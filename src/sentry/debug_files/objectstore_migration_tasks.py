from __future__ import annotations

import logging

from django.db.models import F
from django.utils import timezone
from taskbroker_client.state import current_task

from sentry.debug_files.objectstore_migration import (
    ensure_migration_enabled,
    is_migration_killswitched,
    migrate_debug_file,
    shard_candidates,
)
from sentry.models.debugfile_migration import (
    DebugFileObjectstoreMigrationRun,
    DebugFileObjectstoreMigrationRunStatus,
    DebugFileObjectstoreMigrationShard,
    DebugFileObjectstoreMigrationShardStatus,
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


def enqueue_shard(shard: DebugFileObjectstoreMigrationShard) -> None:
    migrate_shard.apply_async(
        kwargs={
            "run_id": shard.run_id,
            "shard_id": shard.shard_id,
            "expected_generation": shard.generation,
            "expected_task_generation": shard.task_generation,
        },
        headers={"sentry-propagate-traces": False},
    )


def enqueue_shard_heads(run: DebugFileObjectstoreMigrationRun) -> int:
    """Enqueue one activation for each incomplete shard.

    Used by start/resume (and later the control-plane job). Taskbroker worker
    capacity limits concurrency; shards self-chain from there.
    """
    ensure_migration_enabled()
    shards = list(
        run.shards.filter(
            status__in=(
                DebugFileObjectstoreMigrationShardStatus.PENDING,
                DebugFileObjectstoreMigrationShardStatus.RUNNING,
            )
        ).order_by("shard_id")
    )
    for shard in shards:
        enqueue_shard(shard)
    return len(shards)


def _claim_shard(
    *,
    run_id: int,
    shard_id: int,
    expected_generation: int,
    expected_task_generation: int,
) -> DebugFileObjectstoreMigrationShard | None:
    now = timezone.now()
    updated = DebugFileObjectstoreMigrationShard.objects.filter(
        run_id=run_id,
        shard_id=shard_id,
        generation=expected_generation,
        task_generation=expected_task_generation,
        status__in=(
            DebugFileObjectstoreMigrationShardStatus.PENDING,
            DebugFileObjectstoreMigrationShardStatus.RUNNING,
        ),
        run__generation=expected_generation,
        run__status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
    ).update(
        task_generation=F("task_generation") + 1,
        status=DebugFileObjectstoreMigrationShardStatus.RUNNING,
        started_at=now,
    )
    if not updated:
        return None
    return DebugFileObjectstoreMigrationShard.objects.select_related("run").get(
        run_id=run_id, shard_id=shard_id
    )


@instrumented_task(
    name="sentry.debug_files.objectstore_migration.migrate_shard",
    namespace=debug_files_migration_tasks,
    processing_deadline_duration=15 * 60,
    silo_mode=SiloMode.CELL,
)
def migrate_shard(
    run_id: int,
    shard_id: int,
    expected_generation: int,
    expected_task_generation: int,
    **kwargs: object,
) -> None:
    ensure_migration_enabled()
    activation_id = _activation_id()
    if activation_id and already_spawned(_SHARD_TASK_KEY, activation_id):
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _SHARD_TASK_KEY},
        )
        return

    shard = _claim_shard(
        run_id=run_id,
        shard_id=shard_id,
        expected_generation=expected_generation,
        expected_task_generation=expected_task_generation,
    )
    if shard is None:
        metrics.incr("debug_files.objectstore_migration.stale_generation")
        return

    processed = 0
    failing_debug_file_id = None
    try:
        while processed < _MAX_FILES_PER_ACTIVATION:
            candidates = list(shard_candidates(shard, limit=_QUERY_BATCH_SIZE))
            if not candidates:
                _complete_shard(shard)
                return
            for debug_file in candidates:
                if is_migration_killswitched():
                    return
                failing_debug_file_id = debug_file.id
                migrate_debug_file(
                    run_id=run_id,
                    shard_id=shard_id,
                    expected_generation=expected_generation,
                    task_generation=shard.task_generation,
                    debug_file_id=debug_file.id,
                )
                processed += 1
                shard.cursor_id = debug_file.id
                if processed >= _MAX_FILES_PER_ACTIVATION:
                    break
            if len(candidates) < _QUERY_BATCH_SIZE:
                _complete_shard(shard)
                return
    except Exception as error:
        _fail_shard(shard, failing_debug_file_id, error)
        return

    if is_migration_killswitched():
        return
    enqueue_shard(shard)
    if activation_id:
        mark_spawned(_SHARD_TASK_KEY, activation_id)


def _complete_shard(shard: DebugFileObjectstoreMigrationShard) -> None:
    DebugFileObjectstoreMigrationShard.objects.filter(
        id=shard.id,
        generation=shard.generation,
        task_generation=shard.task_generation,
        status=DebugFileObjectstoreMigrationShardStatus.RUNNING,
        run__generation=shard.generation,
        run__status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
    ).update(
        status=DebugFileObjectstoreMigrationShardStatus.COMPLETED,
        finished_at=timezone.now(),
    )


def _fail_shard(
    shard: DebugFileObjectstoreMigrationShard,
    debug_file_id: int | None,
    error: Exception,
) -> None:
    logger.error(
        "debug_files.objectstore_migration.shard_failed",
        extra={
            "run_id": shard.run_id,
            "shard_id": shard.shard_id,
            "debug_file_id": debug_file_id,
            "error_type": type(error).__name__,
        },
    )
    DebugFileObjectstoreMigrationShard.objects.filter(
        id=shard.id,
        generation=shard.generation,
        task_generation=shard.task_generation,
    ).update(
        status=DebugFileObjectstoreMigrationShardStatus.FAILED,
        finished_at=timezone.now(),
        failing_debug_file_id=debug_file_id,
        last_error=f"{type(error).__name__}: {error}"[:256],
    )
    metrics.incr("debug_files.objectstore_migration.files", tags={"result": "failed"})
