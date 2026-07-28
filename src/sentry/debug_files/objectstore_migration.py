from __future__ import annotations

import hashlib
import logging
import os
import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from django.db import OperationalError, router
from django.db.models import F, Func, Max, QuerySet, Value
from django.db.models.fields import IntegerField
from objectstore_client import RequestError, Session
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.constants import KNOWN_DIF_FORMATS
from sentry.models.debugfile import (
    ProjectDebugFile,
    _dif_file_extension,
    _upload_dif_to_objectstore,
)
from sentry.models.project import Project
from sentry.objectstore import get_debug_files_session
from sentry.utils.db import atomic_transaction
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger(__name__)

KILLSWITCH_OPTION = "debug-files.objectstore-migration.killswitch"
MAX_RETRIES = 3
RETRY_BASE_DELAY_SECONDS = 2

_CUTOVER_FIELDS = (
    "storage_path",
    "content_type",
    "file_size",
    "date_created",
    "checksum",
    "file",
)

_RETRIABLE_ERRORS = (RequestError, HTTPError, OperationalError, OSError)


class ObjectstoreIntegrityError(Exception):
    """Objectstore payload checksum/size did not match the legacy File."""


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


def freeze_high_water_mark() -> int:
    return ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0


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
    ensure_migration_enabled()
    if shard_count < 1:
        raise ValueError("shard_count must be positive")

    # Lazy import: tasks import from this module.
    from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads

    if high_water_mark is None:
        high_water_mark = freeze_high_water_mark()

    return enqueue_shard_heads(
        shard_count=shard_count,
        high_water_mark=high_water_mark,
        cursors=cursors,
        shard_ids=shard_ids,
    )


def shard_candidates(
    *,
    shard_id: int,
    shard_count: int,
    high_water_mark: int,
    cursor_id: int,
    limit: int,
) -> QuerySet[ProjectDebugFile]:
    return (
        ProjectDebugFile.objects.filter(
            id__gt=cursor_id,
            id__lte=high_water_mark,
            file_id__isnull=False,
        )
        .annotate(
            _migration_shard=Func(
                F("id"), Value(shard_count), function="MOD", output_field=IntegerField()
            )
        )
        .filter(_migration_shard=shard_id)
        .select_related("file")
        .order_by("id")[:limit]
    )


def _verify_object(
    session: Session,
    storage_path: str,
    *,
    expected_checksum: str,
    expected_size: int,
    content_type: str,
    date_created: datetime,
) -> VerifiedObject | None:
    """Download and checksum an Objectstore object.

    Returns None when the key is missing. Raises ObjectstoreIntegrityError when
    the payload is present but does not match the legacy File.

    ``content_type`` / ``date_created`` always come from the legacy File (or the
    dual-write path that created it). Objectstore response metadata is not used
    for cutover fields — missing/normalized MIME would make ``file_format``
    unknown after cutover.
    """
    response = session.get(storage_path)
    if response is None:
        return None

    digest = hashlib.sha1()
    size = 0
    try:
        while chunk := response.payload.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    finally:
        response.payload.close()

    checksum = digest.hexdigest()
    if checksum != expected_checksum or size != expected_size:
        raise ObjectstoreIntegrityError(
            f"Objectstore payload does not match File "
            f"(checksum={checksum!r} expected={expected_checksum!r}, "
            f"size={size} expected={expected_size})"
        )
    return VerifiedObject(
        storage_path=storage_path,
        content_type=content_type,
        file_size=size,
        # Preserve the original File upload time; Objectstore time_created is migration time.
        date_created=date_created,
        checksum=checksum,
    )


def _prepare_object(debug_file: ProjectDebugFile) -> VerifiedObject | None:
    """Ensure a verified Objectstore object exists for this debug file.

    Returns None when the row cannot be migrated and should be skipped
    (missing project, orphan File pointer, empty checksum, …). Callers treat
    None as success-with-skip so the shard cursor can advance.
    """
    file = debug_file.file
    if file is None:
        # file_id set but File row gone — unmigratable; don't stall the shard.
        logger.info(
            "debug_files.objectstore_migration.file_missing",
            extra={"debug_file_id": debug_file.id, "file_id": debug_file.file_id},
        )
        return None
    if not file.checksum:
        logger.info(
            "debug_files.objectstore_migration.checksum_missing",
            extra={"debug_file_id": debug_file.id, "file_id": file.id},
        )
        return None

    try:
        project = Project.objects.get_from_cache(id=debug_file.project_id)
    except Project.DoesNotExist:
        logger.info(
            "debug_files.objectstore_migration.project_missing",
            extra={"debug_file_id": debug_file.id, "project_id": debug_file.project_id},
        )
        return None

    session = get_debug_files_session(project.organization_id, project.id)
    date_created = file.timestamp
    # Canonical MIME is always taken from the legacy File — same source
    # dual-write uses. Never Objectstore metadata (see _verify_object).
    content_type = file.headers.get("Content-Type", "application/octet-stream")

    # Prefer an already-copied object when present and intact. A corrupt or
    # partial prior copy falls through to a fresh upload.
    if debug_file.storage_path:
        try:
            verified = _verify_object(
                session,
                debug_file.storage_path,
                expected_checksum=file.checksum,
                expected_size=file.size,
                content_type=content_type,
                date_created=date_created,
            )
        except ObjectstoreIntegrityError:
            logger.info(
                "debug_files.objectstore_migration.reusing_corrupt_object",
                extra={
                    "debug_file_id": debug_file.id,
                    "storage_path": debug_file.storage_path,
                },
            )
            verified = None
        if verified is not None:
            return verified

    # Derive format from the legacy File MIME. Do not use debug_file.file_format:
    # with storage_path set + objectstore-debugfiles-read, get_content_type() may
    # assert on a null ProjectDebugFile.content_type that dual-write never filled.
    file_format = KNOWN_DIF_FORMATS.get(content_type.lower(), "unknown")
    filename = (
        f"{os.path.basename(debug_file.debug_id)}"
        f"{_dif_file_extension(file_format, debug_file.file_type)}"
    )
    with file.getfile() as source:
        storage_path = _upload_dif_to_objectstore(
            session, source, content_type, file.size, filename
        )

    # Integrity mismatches and missing keys after upload are retriable: the
    # outer ConditionalRetryPolicy will re-run prepare+cutover.
    verified = _verify_object(
        session,
        storage_path,
        expected_checksum=file.checksum,
        expected_size=file.size,
        content_type=content_type,
        date_created=date_created,
    )
    if verified is None:
        raise ObjectstoreIntegrityError("Uploaded Objectstore payload is missing")
    return verified


def _retry_delay(base_delay: float):
    delay = exponential_delay(base_delay)
    return lambda attempt: random.uniform(delay(attempt), delay(attempt) * 2)


def migrate_debug_file(*, debug_file_id: int) -> int:
    """Migrate one debug file. Returns cutover size, or 0 when skipped."""

    def attempt() -> int:
        try:
            debug_file = ProjectDebugFile.objects.select_related("file").get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            return 0

        if debug_file.file_id is None:
            return 0

        verified = _prepare_object(debug_file)
        if verified is None:
            return 0

        return _commit_cutover(debug_file_id=debug_file_id, verified=verified)

    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, error: attempt_number <= MAX_RETRIES
        and isinstance(error, (*_RETRIABLE_ERRORS, ObjectstoreIntegrityError)),
        delay_function=_retry_delay(RETRY_BASE_DELAY_SECONDS),
    )
    return policy(attempt)


def _commit_cutover(*, debug_file_id: int, verified: VerifiedObject) -> int:
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        try:
            current = ProjectDebugFile.objects.select_for_update().get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            return 0

        # Already cut over (or raced with another worker).
        if current.file_id is None:
            return 0

        current.storage_path = verified.storage_path
        current.content_type = verified.content_type
        current.file_size = verified.file_size
        current.date_created = verified.date_created
        current.checksum = verified.checksum
        current.file = None
        current.save(update_fields=list(_CUTOVER_FIELDS))
        return verified.file_size
