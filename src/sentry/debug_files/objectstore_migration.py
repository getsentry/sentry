from __future__ import annotations

import hashlib
import logging
import os
import random
from dataclasses import dataclass
from datetime import datetime

from django.db import IntegrityError, OperationalError, router, transaction
from django.db.models import F, Func, Max, QuerySet, Value
from django.db.models.fields import IntegerField
from django.utils import timezone
from objectstore_client import RequestError, Session
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.models.debugfile import (
    ProjectDebugFile,
    _dif_file_extension,
    _upload_dif_to_objectstore,
)
from sentry.models.debugfile_migration import (
    DebugFileObjectstoreMigrationRun,
    DebugFileObjectstoreMigrationRunStatus,
    DebugFileObjectstoreMigrationShard,
    DebugFileObjectstoreMigrationShardStatus,
)
from sentry.objectstore import get_debug_files_session
from sentry.utils.db import atomic_transaction
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger(__name__)

KILLSWITCH_OPTION = "debug-files.objectstore-migration.killswitch"
MAX_RETRIES = 3
RETRY_BASE_DELAY_SECONDS = 2


def is_migration_killswitched() -> bool:
    return bool(options.get(KILLSWITCH_OPTION))


def ensure_migration_enabled() -> None:
    if is_migration_killswitched():
        raise RuntimeError("Debug file Objectstore migration is killswitched")


@dataclass(frozen=True)
class VerifiedObject:
    storage_path: str
    content_type: str
    file_size: int
    date_created: datetime
    checksum: str


_ACTIVE_RUN_STATUSES = (
    DebugFileObjectstoreMigrationRunStatus.PENDING,
    DebugFileObjectstoreMigrationRunStatus.RUNNING,
)


def create_migration_run(*, shard_count: int) -> DebugFileObjectstoreMigrationRun:
    ensure_migration_enabled()
    if shard_count < 1:
        raise ValueError("shard_count must be positive")

    database = router.db_for_write(DebugFileObjectstoreMigrationRun)
    with atomic_transaction(using=database):
        if DebugFileObjectstoreMigrationRun.objects.filter(
            status__in=_ACTIVE_RUN_STATUSES
        ).exists():
            raise ValueError("A debug file Objectstore migration is already active")

        high_water_mark = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        try:
            run = DebugFileObjectstoreMigrationRun.objects.create(
                high_water_mark=high_water_mark,
                shard_count=shard_count,
            )
        except IntegrityError as error:
            raise ValueError("A debug file Objectstore migration is already active") from error

        DebugFileObjectstoreMigrationShard.objects.bulk_create(
            [
                DebugFileObjectstoreMigrationShard(
                    run=run,
                    shard_id=shard_id,
                    generation=run.generation,
                )
                for shard_id in range(shard_count)
            ]
        )
    return run


def start_migration_run(run_id: int) -> DebugFileObjectstoreMigrationRun:
    ensure_migration_enabled()
    from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads

    database = router.db_for_write(DebugFileObjectstoreMigrationRun)
    with atomic_transaction(using=database):
        run = DebugFileObjectstoreMigrationRun.objects.select_for_update().get(id=run_id)
        if run.status != DebugFileObjectstoreMigrationRunStatus.PENDING:
            raise ValueError("Only a pending migration run can be started")
        run.status = DebugFileObjectstoreMigrationRunStatus.RUNNING
        run.started_at = timezone.now()
        run.save(update_fields=["status", "started_at", "date_updated"])
        started_run_id = run.id
        transaction.on_commit(
            lambda: enqueue_shard_heads(
                DebugFileObjectstoreMigrationRun.objects.get(id=started_run_id)
            ),
            using=database,
        )
    return run


def resume_failed_shards(run_id: int, shard_ids: list[int] | None = None) -> int:
    """Re-enqueue incomplete shards after failure or killswitch stop.

    Failed shards are reset to pending (cursor preserved). Pending/running shards
    are left as-is and re-seeded onto the queue. Completion/reconcile stays with
    the future control-plane job.
    """
    ensure_migration_enabled()
    from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads

    database = router.db_for_write(DebugFileObjectstoreMigrationRun)
    with atomic_transaction(using=database):
        run = DebugFileObjectstoreMigrationRun.objects.select_for_update().get(id=run_id)
        if run.status not in (
            DebugFileObjectstoreMigrationRunStatus.FAILED,
            DebugFileObjectstoreMigrationRunStatus.RUNNING,
        ):
            raise ValueError("Only a failed or running migration run can be resumed")

        shards = DebugFileObjectstoreMigrationShard.objects.filter(
            run=run,
            status__in=(
                DebugFileObjectstoreMigrationShardStatus.FAILED,
                DebugFileObjectstoreMigrationShardStatus.PENDING,
                DebugFileObjectstoreMigrationShardStatus.RUNNING,
            ),
        )
        if shard_ids is not None:
            shards = shards.filter(shard_id__in=shard_ids)

        # Reset failed shards so they can be claimed again; leave cursors intact.
        shards.filter(status=DebugFileObjectstoreMigrationShardStatus.FAILED).update(
            status=DebugFileObjectstoreMigrationShardStatus.PENDING,
            failing_debug_file_id=None,
            last_error=None,
            finished_at=None,
        )
        incomplete = shards.count()
        if incomplete == 0:
            raise ValueError("No incomplete migration shards matched")

        run.status = DebugFileObjectstoreMigrationRunStatus.RUNNING
        run.finished_at = None
        run.save(update_fields=["status", "finished_at", "date_updated"])
        resumed_run_id = run.id
        transaction.on_commit(
            lambda: enqueue_shard_heads(
                DebugFileObjectstoreMigrationRun.objects.get(id=resumed_run_id)
            ),
            using=database,
        )
    return incomplete


def supersede_migration_run(run_id: int) -> None:
    ensure_migration_enabled()
    database = router.db_for_write(DebugFileObjectstoreMigrationRun)
    with atomic_transaction(using=database):
        run = DebugFileObjectstoreMigrationRun.objects.select_for_update().get(id=run_id)
        if run.status not in _ACTIVE_RUN_STATUSES:
            raise ValueError("Only an active migration run can be superseded")
        run.generation += 1
        run.status = DebugFileObjectstoreMigrationRunStatus.SUPERSEDED
        run.finished_at = timezone.now()
        run.save(update_fields=["generation", "status", "finished_at", "date_updated"])


def shard_candidates(
    shard: DebugFileObjectstoreMigrationShard, *, limit: int
) -> QuerySet[ProjectDebugFile]:
    run = shard.run
    return (
        ProjectDebugFile.objects.filter(
            id__gt=shard.cursor_id,
            id__lte=run.high_water_mark,
            file_id__isnull=False,
        )
        .annotate(
            _migration_shard=Func(
                F("id"), Value(run.shard_count), function="MOD", output_field=IntegerField()
            )
        )
        .filter(_migration_shard=shard.shard_id)
        .select_related("file")
        .order_by("id")[:limit]
    )


def _verify_object(
    session: Session, storage_path: str, expected_checksum: str, expected_size: int
) -> VerifiedObject | None:
    metadata = session.head(storage_path)
    if metadata is None:
        return None

    digest = hashlib.sha1()
    size = 0
    response = session.get(storage_path)
    try:
        while chunk := response.payload.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    finally:
        response.payload.close()

    checksum = digest.hexdigest()
    if checksum != expected_checksum or size != expected_size:
        raise ValueError("Objectstore payload does not match File")
    return VerifiedObject(
        storage_path=storage_path,
        content_type=metadata.content_type or "application/octet-stream",
        file_size=size,
        date_created=metadata.time_created or timezone.now(),
        checksum=checksum,
    )


def _prepare_object(debug_file: ProjectDebugFile) -> VerifiedObject:
    file = debug_file.file
    if file is None:
        raise ValueError("Debug file has no File to migrate")
    if not file.checksum:
        raise ValueError("Debug File source has no checksum")

    from sentry.models.project import Project

    project = Project.objects.get_from_cache(id=debug_file.project_id)
    session = get_debug_files_session(project.organization_id, project.id)
    verified = None
    if debug_file.storage_path:
        verified = _verify_object(session, debug_file.storage_path, file.checksum, file.size)
    if verified is not None:
        return verified

    content_type = file.headers.get("Content-Type", "application/octet-stream")
    filename = f"{os.path.basename(debug_file.debug_id)}{_dif_file_extension(debug_file.file_format, debug_file.file_type)}"
    with file.getfile() as source:
        storage_path = _upload_dif_to_objectstore(
            session, source, content_type, file.size, filename
        )
    verified = _verify_object(session, storage_path, file.checksum, file.size)
    if verified is None:
        raise RuntimeError("Uploaded Objectstore payload is missing")
    return verified


def _retry_delay(base_delay: float):
    delay = exponential_delay(base_delay)
    return lambda attempt: random.uniform(delay(attempt), delay(attempt) * 2)


def migrate_debug_file(
    *,
    run_id: int,
    shard_id: int,
    expected_generation: int,
    task_generation: int,
    debug_file_id: int,
) -> int | None:
    def attempt() -> int | None:
        try:
            debug_file = ProjectDebugFile.objects.select_related("file").get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            return _commit_result(
                run_id=run_id,
                shard_id=shard_id,
                expected_generation=expected_generation,
                task_generation=task_generation,
                debug_file_id=debug_file_id,
                verified=None,
            )

        if debug_file.file_id is None:
            return _commit_result(
                run_id=run_id,
                shard_id=shard_id,
                expected_generation=expected_generation,
                task_generation=task_generation,
                debug_file_id=debug_file_id,
                verified=None,
            )

        verified = _prepare_object(debug_file)
        return _commit_result(
            run_id=run_id,
            shard_id=shard_id,
            expected_generation=expected_generation,
            task_generation=task_generation,
            debug_file_id=debug_file_id,
            verified=verified,
        )

    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, error: attempt_number <= MAX_RETRIES
        and isinstance(error, (RequestError, HTTPError, OperationalError, OSError)),
        delay_function=_retry_delay(RETRY_BASE_DELAY_SECONDS),
    )
    return policy(attempt)


def _commit_result(
    *,
    run_id: int,
    shard_id: int,
    expected_generation: int,
    task_generation: int,
    debug_file_id: int,
    verified: VerifiedObject | None,
) -> int:
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        run = DebugFileObjectstoreMigrationRun.objects.select_for_update().get(id=run_id)
        shard = DebugFileObjectstoreMigrationShard.objects.select_for_update().get(
            run=run, shard_id=shard_id
        )
        if (
            run.generation != expected_generation
            or run.status != DebugFileObjectstoreMigrationRunStatus.RUNNING
            or shard.generation != expected_generation
            or shard.task_generation != task_generation
        ):
            raise RuntimeError("Stale migration task")

        try:
            current = ProjectDebugFile.objects.select_for_update().get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            current = None

        size = 0
        if current is not None and current.file_id is not None:
            if verified is None:
                raise ValueError("Missing verified Objectstore payload")
            current.storage_path = verified.storage_path
            current.content_type = verified.content_type
            current.file_size = verified.file_size
            current.date_created = verified.date_created
            current.checksum = verified.checksum
            current.file_id = None
            current.save(
                update_fields=[
                    "storage_path",
                    "content_type",
                    "file_size",
                    "date_created",
                    "checksum",
                    "file",
                ]
            )
            size = verified.file_size
            shard.files_migrated += 1
            shard.bytes_migrated += size
        else:
            shard.files_skipped += 1

        shard.cursor_id = max(shard.cursor_id, debug_file_id)
        shard.save(
            update_fields=[
                "cursor_id",
                "files_migrated",
                "files_skipped",
                "bytes_migrated",
                "date_updated",
            ]
        )
        return size
