from __future__ import annotations

import logging
import os
from tempfile import NamedTemporaryFile
from typing import Any

import orjson

from sentry.models.organization import Organization
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.storage import SnapshotStorage, get_snapshot_storage
from sentry.preprod.snapshots.zip_builder import (
    SnapshotZipBuildError,
    archive_exists,
    archive_object_key,
    build_snapshot_zip,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_snapshots_tasks
from sentry.users.services.user.service import user_service
from sentry.utils.email import MessageBuilder

logger = logging.getLogger(__name__)


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


def _archive_available(org_id: int, project_id: int, artifact_id: int) -> bool:
    try:
        session = get_snapshot_storage(project_id, org=org_id)
        return archive_exists(session, archive_object_key(artifact_id))
    except Exception:
        return False


@instrumented_task(
    name="sentry.preprod.tasks.build_snapshot_images_zip",
    namespace=preprod_snapshots_tasks,
    silo_mode=SiloMode.CELL,
    processing_deadline_duration=900,
)
def build_snapshot_images_zip(
    org_id: int,
    project_id: int,
    artifact_id: int,
    user_id: int | None = None,
    **kwargs: Any,
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

        session = get_snapshot_storage(project_id, org=org_id)
        key = archive_object_key(artifact_id)

        # Snapshot images for a given artifact are immutable, so a stored archive
        # is always valid: skip the rebuild and just re-send the link.
        if archive_exists(session, key):
            logger.info(
                "preprod_snapshot_zip.archive_cache_hit",
                extra={"preprod_artifact_id": artifact_id, "key": key},
            )
        else:
            manifest, manifest_bytes = _load_manifest(session, manifest_key)
            manifest_size_bytes = len(manifest_bytes)
            logger.info(
                "preprod_snapshot_zip.manifest_loaded",
                extra={
                    "preprod_artifact_id": artifact_id,
                    "image_count": len(manifest.images),
                    "manifest_size_bytes": manifest_size_bytes,
                },
            )
            with NamedTemporaryFile() as tmp:
                build_snapshot_zip(
                    manifest,
                    session,
                    f"{org_id}/{project_id}",
                    tmp,
                    artifact_id=artifact_id,
                    manifest_bytes=manifest_bytes,
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
                session.put(
                    tmp,
                    key=key,
                    content_type="application/zip",
                    # A `zip` is already compressed, so it would likely be not beneficial to compress it again.
                    compress="none",
                    # Force this `put` to use a resumable upload, overriding the default threshold.
                    # This already incorporates retries with exponential backoffs and allows the client to retry
                    # from the persisted offset when the upload fails midway through.
                    resumable_threshold_bytes=0,
                )
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


def _load_manifest(session: SnapshotStorage, manifest_key: str) -> tuple[SnapshotManifest, bytes]:
    """Return the validated manifest and its original objectstore payload bytes."""
    response = session.get(manifest_key)
    if response is None:
        raise FileNotFoundError("Manifest does not exist in objectstore")
    try:
        manifest_bytes = response.payload.read()
        manifest_data = orjson.loads(manifest_bytes)
    finally:
        response.payload.close()
    return SnapshotManifest(**manifest_data), manifest_bytes
