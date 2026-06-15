from __future__ import annotations

import logging
import os
import time
from tempfile import NamedTemporaryFile
from typing import IO

import orjson
from objectstore_client import RequestError, Session
from objectstore_client.multipart import CompletePart, MultipartUpload
from urllib3.exceptions import HTTPError

from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.zip_builder import (
    SnapshotZipBuildError,
    archive_exists,
    archive_object_key,
    build_snapshot_zip,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.users.services.user.service import user_service
from sentry.utils.email import MessageBuilder

logger = logging.getLogger(__name__)

MULTIPART_PART_SIZE = 32 * 1024 * 1024
MULTIPART_MAX_RETRIES = 3


def _snapshot_page_url(organization: Organization, artifact_id: int) -> str:
    # Link to the snapshots UI rather than the raw download endpoint: the page's
    # "Download Images" action downloads the (now ready) archive directly.
    path = f"/organizations/{organization.slug}/preprod/snapshots/{artifact_id}"
    return organization.absolute_url(path)


def _recipient_email(user_id: int | None) -> str | None:
    if user_id is None:
        return None
    user = user_service.get_user(user_id=user_id)
    return user.email if user and user.email else None


def _send_archive_email(
    organization: Organization, user_id: int | None, artifact_id: int, *, ready: bool
) -> None:
    email = _recipient_email(user_id)
    if not email:
        return
    subject = (
        "Your snapshot images are ready." if ready else "We couldn't build your snapshot images."
    )
    slug = "ready" if ready else "failed"
    MessageBuilder(
        subject=subject,
        context={"url": _snapshot_page_url(organization, artifact_id)},
        type=f"preprod.snapshot-archive-{slug}",
        template=f"sentry/emails/snapshot-archive-{slug}.txt",
        html_template=f"sentry/emails/snapshot-archive-{slug}.html",
    ).send_async([email])


def _put_part_with_retry(upload: MultipartUpload, chunk: bytes, part_number: int) -> CompletePart:
    for attempt in range(MULTIPART_MAX_RETRIES):
        try:
            return upload.put_part(chunk, part_number=part_number, content_length=len(chunk))
        except (RequestError, HTTPError):
            if attempt == MULTIPART_MAX_RETRIES - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def _archive_available(org_id: int, project_id: int, artifact_id: int) -> bool:
    try:
        session = get_preprod_session(org_id, project_id)
        return archive_exists(session, archive_object_key(artifact_id))
    except Exception:
        return False


def _upload_archive_multipart(session: Session, key: str, tmp: IO[bytes]) -> None:
    upload = session.initiate_multipart_upload(
        key=key, compression="none", content_type="application/zip"
    )
    try:
        parts: list[CompletePart] = []
        part_number = 1
        while True:
            chunk = tmp.read(MULTIPART_PART_SIZE)
            if not chunk:
                break
            parts.append(_put_part_with_retry(upload, chunk, part_number))
            part_number += 1
        upload.complete(parts)
    except Exception:
        try:
            upload.abort()
        except (RequestError, HTTPError):
            logger.warning("preprod_snapshot_zip.archive_abort_failed", extra={"key": key})
        raise


@instrumented_task(
    name="sentry.preprod.tasks.build_snapshot_images_zip",
    namespace=preprod_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=900,
)
def build_snapshot_images_zip(
    org_id: int, project_id: int, artifact_id: int, user_id: int | None = None
) -> None:
    logger.info(
        "preprod_snapshot_zip.build_started",
        extra={
            "preprod_artifact_id": artifact_id,
            "organization_id": org_id,
            "project_id": project_id,
            "user_id": user_id,
        },
    )
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning(
            "preprod_snapshot_zip.organization_not_found",
            extra={
                "preprod_artifact_id": artifact_id,
                "organization_id": org_id,
                "project_id": project_id,
                "user_id": user_id,
            },
        )
        return

    # Any failure here must reach the user: there is no persisted build state to
    # poll, so an unhandled exception would leave the request silently stuck.
    try:
        try:
            snapshot_metrics = PreprodSnapshotMetrics.objects.get(preprod_artifact_id=artifact_id)
        except PreprodSnapshotMetrics.DoesNotExist:
            raise SnapshotZipBuildError(f"missing metrics for artifact {artifact_id}")

        manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
        if not manifest_key:
            raise SnapshotZipBuildError(f"missing manifest_key for artifact {artifact_id}")

        session = get_preprod_session(org_id, project_id)
        key = archive_object_key(artifact_id)

        # Snapshot images for a given artifact are immutable, so a stored archive
        # is always valid: skip the rebuild and just re-send the link.
        if archive_exists(session, key):
            logger.info(
                "preprod_snapshot_zip.archive_cache_hit",
                extra={"preprod_artifact_id": artifact_id, "key": key},
            )
        else:
            manifest = _load_manifest(session, manifest_key)
            logger.info(
                "preprod_snapshot_zip.manifest_loaded",
                extra={
                    "preprod_artifact_id": artifact_id,
                    "image_count": len(manifest.images),
                },
            )
            with NamedTemporaryFile() as tmp:
                build_snapshot_zip(
                    manifest, session, f"{org_id}/{project_id}", tmp, artifact_id=artifact_id
                )
                tmp.flush()
                tmp.seek(0)
                archive_size_bytes = os.fstat(tmp.fileno()).st_size
                logger.info(
                    "preprod_snapshot_zip.upload_started",
                    extra={
                        "preprod_artifact_id": artifact_id,
                        "key": key,
                        "archive_size_bytes": archive_size_bytes,
                    },
                )
                _upload_archive_multipart(session, key, tmp)
                logger.info(
                    "preprod_snapshot_zip.upload_completed",
                    extra={
                        "preprod_artifact_id": artifact_id,
                        "key": key,
                        "archive_size_bytes": archive_size_bytes,
                    },
                )
    except Exception:
        logger.exception(
            "preprod_snapshot_zip.build_failed",
            extra={"preprod_artifact_id": artifact_id},
        )
        if _archive_available(org_id, project_id, artifact_id):
            logger.info(
                "preprod_snapshot_zip.failure_superseded_by_existing_archive",
                extra={"preprod_artifact_id": artifact_id},
            )
            _send_archive_email(organization, user_id, artifact_id, ready=True)
            return
        _send_archive_email(organization, user_id, artifact_id, ready=False)
        return

    logger.info(
        "preprod_snapshot_zip.build_succeeded",
        extra={
            "preprod_artifact_id": artifact_id,
            "organization_id": org_id,
            "project_id": project_id,
            "user_id": user_id,
        },
    )
    _send_archive_email(organization, user_id, artifact_id, ready=True)


def _load_manifest(session: Session, manifest_key: str) -> SnapshotManifest:
    response = session.get(manifest_key)
    try:
        manifest_data = orjson.loads(response.payload.read())
    finally:
        response.payload.close()
    return SnapshotManifest(**manifest_data)
