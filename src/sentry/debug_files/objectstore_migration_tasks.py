from __future__ import annotations

import logging
from datetime import timedelta

from django.db import router
from django.db.models import Count, F, Func, IntegerField, Min, Value
from django.utils import timezone
from taskbroker_client.state import current_task

from sentry import options
from sentry.debug_files.objectstore_migration import (
    ensure_migration_enabled,
    is_migration_killswitched,
    migrate_debug_file,
    shard_candidates,
)
from sentry.models.debugfile import ProjectDebugFile
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
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)

_COORDINATOR_TASK_KEY = "debug_files_objectstore_migration_coordinator"
_SHARD_TASK_KEY = "debug_files_objectstore_migration_shard"
_QUERY_BATCH_SIZE = 20
_MAX_FILES_PER_ACTIVATION = 50


def _activation_id() -> str | None:
    task = current_task()
    return task.id if task else None


def _enqueue_shard(shard: DebugFileObjectstoreMigrationShard) -> None:
    migrate_shard.apply_async(
        kwargs={
            "run_id": shard.run_id,
            "shard_id": shard.shard_id,
            "expected_generation": shard.generation,
            "expected_task_generation": shard.task_generation,
        },
        headers={"sentry-propagate-traces": False},
    )


@instrumented_task(
    name="sentry.debug_files.objectstore_migration.coordinate",
    namespace=debug_files_migration_tasks,
    processing_deadline_duration=5 * 60,
    silo_mode=SiloMode.CELL,
)
def coordinate_migration(run_id: int, expected_generation: int, **kwargs: object) -> None:
    ensure_migration_enabled()
    activation_id = _activation_id()
    if activation_id and already_spawned(_COORDINATOR_TASK_KEY, activation_id):
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _COORDINATOR_TASK_KEY},
        )
        return
    try:
        run = DebugFileObjectstoreMigrationRun.objects.get(id=run_id)
    except DebugFileObjectstoreMigrationRun.DoesNotExist:
        return
    if (
        run.generation != expected_generation
        or run.status != DebugFileObjectstoreMigrationRunStatus.RUNNING
    ):
        metrics.incr("debug_files.objectstore_migration.stale_generation")
        return

    now = timezone.now()
    stale_before = now - timedelta(
        seconds=options.get("debug-files.objectstore-migration.stale-heartbeat-seconds")
    )
    run.last_coordinator_at = now
    run.save(update_fields=["last_coordinator_at", "date_updated"])

    shards = list(run.shards.all().order_by("shard_id"))
    for shard in shards:
        if shard.status == DebugFileObjectstoreMigrationShardStatus.PENDING or (
            shard.status == DebugFileObjectstoreMigrationShardStatus.RUNNING
            and (shard.heartbeat_at is None or shard.heartbeat_at < stale_before)
        ):
            _enqueue_shard(shard)

    counts = dict(
        run.shards.values_list("status").annotate(count=Count("id")).values_list("status", "count")
    )
    active = counts.get(DebugFileObjectstoreMigrationShardStatus.PENDING, 0) + counts.get(
        DebugFileObjectstoreMigrationShardStatus.RUNNING, 0
    )
    if active == 0:
        if counts.get(DebugFileObjectstoreMigrationShardStatus.FAILED, 0):
            _finish_run(run, DebugFileObjectstoreMigrationRunStatus.FAILED)
            return
        if _reconcile_completed_run(run):
            return

    coordinate_migration.apply_async(
        kwargs={"run_id": run.id, "expected_generation": run.generation},
        countdown=options.get("debug-files.objectstore-migration.coordinator-interval-seconds"),
        headers={"sentry-propagate-traces": False},
    )
    if activation_id:
        mark_spawned(_COORDINATOR_TASK_KEY, activation_id)


def _finish_run(
    run: DebugFileObjectstoreMigrationRun, status: DebugFileObjectstoreMigrationRunStatus
) -> None:
    DebugFileObjectstoreMigrationRun.objects.filter(
        id=run.id,
        generation=run.generation,
        status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
    ).update(status=status, finished_at=timezone.now())


def _reconcile_completed_run(run: DebugFileObjectstoreMigrationRun) -> bool:
    residuals = list(
        ProjectDebugFile.objects.filter(id__lte=run.high_water_mark, file_id__isnull=False)
        .annotate(
            migration_shard=Func(
                F("id"),
                Value(run.shard_count),
                function="MOD",
                output_field=IntegerField(),
            ),
        )
        .values("migration_shard")
        .annotate(min_id=Min("id"))
    )
    if not residuals:
        _finish_run(run, DebugFileObjectstoreMigrationRunStatus.COMPLETED)
        return True

    database = router.db_for_write(DebugFileObjectstoreMigrationShard)
    with atomic_transaction(using=database):
        locked_run = DebugFileObjectstoreMigrationRun.objects.select_for_update().get(id=run.id)
        if (
            locked_run.generation != run.generation
            or locked_run.status != DebugFileObjectstoreMigrationRunStatus.RUNNING
        ):
            return True
        for residual in residuals:
            DebugFileObjectstoreMigrationShard.objects.filter(
                run=locked_run,
                shard_id=residual["migration_shard"],
                generation=run.generation,
            ).update(
                status=DebugFileObjectstoreMigrationShardStatus.PENDING,
                cursor_id=max(0, residual["min_id"] - 1),
                heartbeat_at=None,
                finished_at=None,
            )
    return False


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
        heartbeat_at=now,
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
    migrate_shard.apply_async(
        kwargs={
            "run_id": run_id,
            "shard_id": shard_id,
            "expected_generation": expected_generation,
            "expected_task_generation": shard.task_generation,
        },
        headers={"sentry-propagate-traces": False},
    )
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
        heartbeat_at=timezone.now(),
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
        heartbeat_at=timezone.now(),
        finished_at=timezone.now(),
        failing_debug_file_id=debug_file_id,
        last_error=f"{type(error).__name__}: {error}"[:256],
    )
    metrics.incr("debug_files.objectstore_migration.files", tags={"result": "failed"})
