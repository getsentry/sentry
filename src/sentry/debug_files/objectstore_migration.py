from __future__ import annotations

import hashlib
import logging
import os
import random
from dataclasses import dataclass
from datetime import datetime

from django.db import OperationalError, router, transaction
from django.db.models import F, Func, Max, QuerySet, Value
from django.db.models.fields import IntegerField
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
    DebugFileObjectstoreMigrationShard,
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


def start_migration(*, shard_count: int) -> DebugFileObjectstoreMigrationRun:
    """Create a run, freeze the high-water mark, and enqueue all shard heads."""
    ensure_migration_enabled()
    if shard_count < 1:
        raise ValueError("shard_count must be positive")

    from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads

    database = router.db_for_write(DebugFileObjectstoreMigrationRun)
    with atomic_transaction(using=database):
        high_water_mark = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        run = DebugFileObjectstoreMigrationRun.objects.create(
            high_water_mark=high_water_mark,
            shard_count=shard_count,
        )
        DebugFileObjectstoreMigrationShard.objects.bulk_create(
            [
                DebugFileObjectstoreMigrationShard(run=run, shard_id=shard_id)
                for shard_id in range(shard_count)
            ]
        )
        run_id = run.id
        transaction.on_commit(
            lambda: enqueue_shard_heads(DebugFileObjectstoreMigrationRun.objects.get(id=run_id)),
            using=database,
        )
    return run


def resume_migration(run_id: int, shard_ids: list[int] | None = None) -> int:
    """Re-enqueue shard heads for an existing run (cursors preserved)."""
    ensure_migration_enabled()
    from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads

    run = DebugFileObjectstoreMigrationRun.objects.get(id=run_id)
    return enqueue_shard_heads(run, shard_ids=shard_ids)


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
    session: Session,
    storage_path: str,
    *,
    expected_checksum: str,
    expected_size: int,
    date_created: datetime,
) -> VerifiedObject | None:
    metadata = session.head(storage_path)
    if metadata is None:
        return None

    digest = hashlib.sha1()
    size = 0
    response = session.get(storage_path)
    if response is None:
        return None
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
        # Preserve the original File upload time; Objectstore time_created is migration time.
        date_created=date_created,
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
    date_created = file.timestamp
    verified = None
    if debug_file.storage_path:
        verified = _verify_object(
            session,
            debug_file.storage_path,
            expected_checksum=file.checksum,
            expected_size=file.size,
            date_created=date_created,
        )
    if verified is not None:
        return verified

    content_type = file.headers.get("Content-Type", "application/octet-stream")
    filename = f"{os.path.basename(debug_file.debug_id)}{_dif_file_extension(debug_file.file_format, debug_file.file_type)}"
    with file.getfile() as source:
        storage_path = _upload_dif_to_objectstore(
            session, source, content_type, file.size, filename
        )
    verified = _verify_object(
        session,
        storage_path,
        expected_checksum=file.checksum,
        expected_size=file.size,
        date_created=date_created,
    )
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
    debug_file_id: int,
) -> int | None:
    def attempt() -> int | None:
        try:
            debug_file = ProjectDebugFile.objects.select_related("file").get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            return _commit_result(
                run_id=run_id,
                shard_id=shard_id,
                debug_file_id=debug_file_id,
                verified=None,
            )

        if debug_file.file_id is None:
            return _commit_result(
                run_id=run_id,
                shard_id=shard_id,
                debug_file_id=debug_file_id,
                verified=None,
            )

        verified = _prepare_object(debug_file)
        return _commit_result(
            run_id=run_id,
            shard_id=shard_id,
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
    debug_file_id: int,
    verified: VerifiedObject | None,
) -> int:
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        # Lock only the shard row. The run is immutable after start; locking it
        # would serialize concurrent shard cutovers on a shared row.
        try:
            shard = (
                DebugFileObjectstoreMigrationShard.objects.select_for_update()
                .select_related("run")
                .get(run_id=run_id, shard_id=shard_id)
            )
        except DebugFileObjectstoreMigrationShard.DoesNotExist as error:
            raise RuntimeError("Unknown migration run or shard") from error

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

        shard.cursor_id = max(shard.cursor_id, debug_file_id)
        shard.save(update_fields=["cursor_id", "date_updated"])
        return size
