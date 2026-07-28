from __future__ import annotations

import hashlib
import logging
import os
import random
from dataclasses import dataclass
from datetime import datetime

from django.db import OperationalError, router, transaction
from django.db.models import ProtectedError
from objectstore_client import RequestError
from urllib3.exceptions import HTTPError

from sentry.constants import KNOWN_DIF_FORMATS
from sentry.models.debugfile import (
    ProjectDebugFile,
    _dif_file_extension,
    _upload_dif_to_objectstore,
)
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.objectstore import get_debug_files_session
from sentry.utils.db import atomic_transaction
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger(__name__)


def migrate_debug_file(debug_file_id: int) -> None:
    """Migrate one File-backed debug file over to Objectstore, or skip it if already migrated."""

    def attempt() -> None:
        try:
            debug_file = ProjectDebugFile.objects.select_related("file").get(id=debug_file_id)
        except ProjectDebugFile.DoesNotExist:
            return

        source_file_id = debug_file.file_id
        if source_file_id is None:
            return

        metadata = upload_and_verify(debug_file)
        if metadata is None:
            return
        commit(debug_file_id, metadata, source_file_id=source_file_id)

    base_delay = exponential_delay(2)
    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, error: attempt_number <= 3
        and isinstance(
            error, (RequestError, HTTPError, OperationalError, OSError, MigrationIntegrityError)
        ),
        delay_function=lambda n: random.uniform(base_delay(n), base_delay(n) * 2),
    )
    policy(attempt)


@dataclass(frozen=True)
class PostMigrationMetadata:
    storage_path: str
    content_type: str
    file_size: int
    date_created: datetime
    checksum: str


class MigrationIntegrityError(Exception):
    """Payload checksum/size did not match the legacy File."""


def _sha1_stream(stream) -> tuple[str, int]:
    """SHA-1 a readable stream without closing it."""
    digest = hashlib.sha1()
    size = 0
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)
        size += len(chunk)
    return digest.hexdigest(), size


def upload_and_verify(debug_file: ProjectDebugFile) -> PostMigrationMetadata | None:
    """Read the File, write it to Objectstore, and verify the stored object.

    Returns:
        Metadata to commit, or ``None`` to skip.

    Raises:
        MigrationIntegrityError: Local File or Objectstore payload mismatch.
        RequestError, HTTPError, OSError: Transient I/O or network failures.
    """
    file = debug_file.file
    if file is None:
        return None

    try:
        project = Project.objects.get_from_cache(id=debug_file.project_id)
    except Project.DoesNotExist:
        return None

    session = get_debug_files_session(project.organization_id, project.id)

    content_type = file.headers.get("Content-Type", "application/octet-stream")
    date_created = file.timestamp
    recorded_checksum = file.checksum
    recorded_size = file.size
    file_format = KNOWN_DIF_FORMATS.get(content_type.lower(), "unknown")
    filename = (
        f"{os.path.basename(debug_file.debug_id)}"
        f"{_dif_file_extension(file_format, debug_file.file_type)}"
    )

    if not recorded_checksum:
        logger.warning(
            "debug_files.objectstore_migration.checksum_missing",
            extra={"debug_file_id": debug_file.id, "file_id": file.id},
        )

    with file.getfile() as stream:
        local_checksum, local_size = _sha1_stream(stream)
        expected_checksum = recorded_checksum or local_checksum
        expected_size = recorded_size if recorded_size is not None else local_size
        if local_checksum != expected_checksum or local_size != expected_size:
            raise MigrationIntegrityError(
                f"Filestore payload does not match File record "
                f"(checksum={local_checksum!r} expected={expected_checksum!r}, "
                f"size={local_size} expected={expected_size})"
            )
        stream.seek(0)
        storage_path = _upload_dif_to_objectstore(
            session, stream, content_type, expected_size, filename
        )

    response = session.get(storage_path)
    if response is None:
        raise MigrationIntegrityError("Object not found in Objectstore")
    try:
        remote_checksum, remote_size = _sha1_stream(response.payload)
    finally:
        response.payload.close()
    if remote_checksum != expected_checksum or remote_size != expected_size:
        raise MigrationIntegrityError(
            f"Objectstore payload does not match File "
            f"(checksum={remote_checksum!r} expected={expected_checksum!r}, "
            f"size={remote_size} expected={expected_size})"
        )

    return PostMigrationMetadata(
        storage_path=storage_path,
        content_type=content_type,
        file_size=expected_size,
        date_created=date_created,
        checksum=expected_checksum,
    )


def commit(
    dif_id: int,
    metadata: PostMigrationMetadata,
    *,
    source_file_id: int,
) -> None:
    """Commit Objectstore metadata onto the DIF and clear ``file``.

    Takes a short row lock only for the update. No-ops when:
    - the row is gone,
    - already cut over (``file_id is None``), or
    - ``file_id`` no longer matches ``source_file_id`` (identity changed under us).

    After a successful commit, schedules deletion of ``source_file_id`` if it is
    unreferenced.
    """
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        try:
            dif = ProjectDebugFile.objects.select_for_update().get(id=dif_id)
        except ProjectDebugFile.DoesNotExist:
            return

        if dif.file_id is None or dif.file_id != source_file_id:
            return

        dif.storage_path = metadata.storage_path
        dif.content_type = metadata.content_type
        dif.file_size = metadata.file_size
        dif.date_created = metadata.date_created
        dif.checksum = metadata.checksum
        dif.file = None
        dif.save(
            update_fields=[
                "storage_path",
                "content_type",
                "file_size",
                "date_created",
                "checksum",
                "file",
            ]
        )
        transaction.on_commit(
            lambda file_id=source_file_id: try_cleanup_file(file_id),
            using=database,
        )


def try_cleanup_file(file_id: int | None) -> None:
    """Delete the `File` with the given ID if unreferenced."""
    if file_id is None:
        return

    try:
        try:
            file = File.objects.get(id=file_id)
        except File.DoesNotExist:
            return

        try:
            file.delete()
        except ProtectedError:
            pass
    except Exception:
        logger.exception(
            "debug_files.objectstore_migration.file_delete_failed",
            extra={"file_id": file_id},
            exc_info=True,
        )
