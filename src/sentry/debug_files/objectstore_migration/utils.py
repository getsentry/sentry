from __future__ import annotations

import hashlib
import logging
import os
import random
import tempfile
from dataclasses import dataclass
from datetime import datetime
from typing import IO

from django.db import router, transaction
from django.db.models import ProtectedError
from objectstore_client import GetResponse, Session

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


def migrate_debug_file(debug_file: ProjectDebugFile) -> None:
    """Migrate one File-backed DIF, or drop the legacy File from a dual-written DIF."""

    def attempt() -> None:
        source_file_id = debug_file.file_id
        if source_file_id is None:
            return

        if debug_file.storage_path is not None:
            drop_legacy_file(debug_file.id, source_file_id=source_file_id)
            return

        metadata = upload_and_verify(debug_file)
        if metadata is None:
            return
        commit(debug_file.id, metadata, source_file_id=source_file_id)

    base_delay = exponential_delay(2)
    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, _: attempt_number <= 3,
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


def _sha1_stream(stream: IO[bytes]) -> tuple[str, int]:
    """SHA-1 a one-shot stream and close it. Returns ``(checksum, size)``."""
    digest = hashlib.sha1()
    size = 0
    try:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    finally:
        stream.close()
    return digest.hexdigest(), size


def _spool_to_tempfile(file: File) -> tuple[IO[bytes], str, int]:
    """Download ``file`` once into a tempfile, hashing as we go.

    Returns ``(tmp, checksum, size)``. Caller must close ``tmp`` (deletes the file).
    """
    digest = hashlib.sha1()
    size = 0
    tmp = tempfile.NamedTemporaryFile(prefix="dif-migrate-")
    try:
        with file.getfile() as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                tmp.write(chunk)
                size += len(chunk)
        tmp.flush()
        tmp.seek(0)
    except Exception:
        tmp.close()
        raise
    return tmp, digest.hexdigest(), size


def _get_object_with_retry(session: Session, storage_path: str) -> GetResponse:
    """Retry verification reads without re-uploading the DIF."""

    def get_object() -> GetResponse:
        response = session.get(storage_path)
        if response is None:
            raise MigrationIntegrityError("Object not found in Objectstore")
        return response

    base_delay = exponential_delay(2)
    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, error: (
            not isinstance(error, MigrationIntegrityError) and attempt_number <= 3
        ),
        delay_function=lambda n: random.uniform(base_delay(n), base_delay(n) * 2),
    )
    return policy(get_object)


def upload_and_verify(debug_file: ProjectDebugFile) -> PostMigrationMetadata | None:
    """Read the File, write it to Objectstore, and verify the stored object.

    Returns:
        Metadata to commit, or ``None`` to skip.

    Raises:
        MigrationIntegrityError: Local File or Objectstore payload mismatch.
        Exception: I/O, network, or other failures during spool/upload/verify.
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

    tmp, local_checksum, local_size = _spool_to_tempfile(file)
    try:
        expected_checksum = recorded_checksum or local_checksum
        expected_size = recorded_size if recorded_size is not None else local_size
        if local_checksum != expected_checksum or local_size != expected_size:
            raise MigrationIntegrityError(
                f"Filestore payload does not match File record "
                f"(checksum={local_checksum!r} expected={expected_checksum!r}, "
                f"size={local_size} expected={expected_size})"
            )
        storage_path = _upload_dif_to_objectstore(
            session,
            tmp,
            content_type,
            expected_size,
            filename,
            key=f"legacy.{debug_file.id}",
        )
    finally:
        tmp.close()

    # We're already inside a retry loop, but we additionally retry this internally in an effort to not waste the work done so far due to a failure that could simply be due to transient network instability.
    response = _get_object_with_retry(session, storage_path)
    remote_checksum, remote_size = _sha1_stream(response.payload)
    if remote_checksum != expected_checksum or remote_size != expected_size:
        try:
            session.delete(storage_path)
        except Exception:
            logger.exception(
                "debug_files.objectstore_migration.unverified_object_delete_failed",
                extra={"debug_file_id": debug_file.id, "storage_path": storage_path},
            )
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

    After a successful commit, deletes ``file`` if it is unreferenced.
    """
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        updated = ProjectDebugFile.objects.filter(id=dif_id, file_id=source_file_id).update(
            storage_path=metadata.storage_path,
            content_type=metadata.content_type,
            file_size=metadata.file_size,
            date_created=metadata.date_created,
            checksum=metadata.checksum,
            file_id=None,
        )
        if not updated:
            logger.warning(
                "debug_files.objectstore_migration.cutover_skipped",
                extra={"debug_file_id": dif_id, "source_file_id": source_file_id},
            )
            return

        transaction.on_commit(lambda: try_cleanup_file(source_file_id), using=database)


def drop_legacy_file(dif_id: int, *, source_file_id: int) -> None:
    """Clear the legacy File from a DIF that is already Objectstore-backed."""
    database = router.db_for_write(ProjectDebugFile)
    with atomic_transaction(using=database):
        updated = ProjectDebugFile.objects.filter(
            id=dif_id,
            file_id=source_file_id,
            storage_path__isnull=False,
        ).update(file_id=None)
        if not updated:
            return

        transaction.on_commit(lambda: try_cleanup_file(source_file_id), using=database)


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
