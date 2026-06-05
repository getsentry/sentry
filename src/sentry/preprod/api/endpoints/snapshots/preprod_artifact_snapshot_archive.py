from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import IO

from django.conf import settings
from django.http import HttpResponseBase, StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from objectstore_client import RequestError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.zip_builder import archive_exists, archive_object_key
from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

DOWNLOAD_CHUNK_SIZE = 8192


def _stream_object(payload: IO[bytes]) -> Iterator[bytes]:
    try:
        while True:
            chunk = payload.read(DOWNLOAD_CHUNK_SIZE)
            if not chunk:
                break
            yield chunk
    finally:
        payload.close()


@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class OrganizationPreprodSnapshotArchiveEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationReleasePermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=5, window=60),
                RateLimitCategory.USER: RateLimit(limit=5, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=30, window=60 * 60),
            },
        }
    )

    def _resolve(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics] | Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related("project").get(
                id=snapshot_id, project__organization_id=organization.id
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Snapshot not found"}, status=404)

        if not is_active_staff(request) and not request.access.has_project_access(artifact.project):
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        if not (metrics.extras or {}).get("manifest_key"):
            return Response({"detail": "Manifest key not found"}, status=404)

        return artifact, metrics

    def _download(self, artifact: PreprodArtifact) -> HttpResponseBase:
        session = get_preprod_session(artifact.project.organization_id, artifact.project_id)
        try:
            result = session.get(archive_object_key(artifact.id))
        except RequestError as e:
            if e.status == 404:
                return Response({"detail": "Download not ready"}, status=409)
            raise

        response = StreamingHttpResponse(
            _stream_object(result.payload), content_type="application/zip"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="snapshot_images_{artifact.id}.zip"'
        )
        # Superuser/cross-org downloads traverse the control-silo nginx path, which
        # buffers to a temp file capped at 1GB and truncates larger responses.
        response["X-Accel-Buffering"] = "no"
        return response

    def _archive_exists(self, artifact: PreprodArtifact) -> bool:
        session = get_preprod_session(artifact.project.organization_id, artifact.project_id)
        try:
            return archive_exists(session, archive_object_key(artifact.id))
        except RequestError:
            return False

    def get(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> HttpResponseBase:
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        artifact, _metrics = resolved

        if request.GET.get("download") is not None:
            return self._download(artifact)

        # Readiness probe (no side effect): lets the UI download a ready archive
        # directly instead of re-triggering a build.
        return Response({"ready": self._archive_exists(artifact)})

    def post(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> HttpResponseBase:
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        artifact, _metrics = resolved
        user_id = getattr(request.user, "id", None)

        try:
            build_snapshot_images_zip.apply_async(
                kwargs={
                    "org_id": artifact.project.organization_id,
                    "project_id": artifact.project_id,
                    "artifact_id": artifact.id,
                    "user_id": user_id,
                }
            )
        except Exception:
            logger.exception(
                "preprod_snapshot_zip.enqueue_failed",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "organization_id": artifact.project.organization_id,
                    "project_id": artifact.project_id,
                    "user_id": user_id,
                },
            )
            return Response(
                {"detail": "Couldn't start the build. Please try again."},
                status=503,
            )
        logger.info(
            "preprod_snapshot_zip.build_enqueued",
            extra={
                "preprod_artifact_id": artifact.id,
                "organization_id": artifact.project.organization_id,
                "project_id": artifact.project_id,
                "user_id": user_id,
            },
        )
        return Response(
            {
                "detail": "Building your snapshot archive — we'll email you a download "
                "link when it's ready."
            },
            status=202,
        )
