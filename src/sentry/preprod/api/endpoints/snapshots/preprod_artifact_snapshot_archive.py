from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import IO, Annotated, TypedDict

from django.http import StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from objectstore_client import RequestError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_TOO_MANY_REQUESTS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.auth.staff import is_active_staff
from sentry.issues.action_log.request import resolve_action_source
from sentry.models.organization import Organization
from sentry.preprod.analytics import PreprodArtifactApiSnapshotArchiveDownloadEvent
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.storage import get_snapshot_storage
from sentry.preprod.snapshots.zip_builder import archive_exists, archive_object_key
from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

DOWNLOAD_CHUNK_SIZE = 8192

SNAPSHOT_ID_PARAMETER = OpenApiParameter(
    name="snapshot_id",
    type=str,
    location="path",
    required=True,
    description="The ID of the snapshot.",
)


class SnapshotArchiveStatusResponse(TypedDict):
    ready: Annotated[
        bool, ApiDescription("Whether the archive of the snapshot's images is built and ready")
    ]


class SnapshotArchiveBuildResponse(TypedDict):
    detail: Annotated[str, ApiDescription("Message saying that the archive is being built")]


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
        "GET": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
        "POST": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    # Every POST queues another archive build, which emails the requester when it's done.
    idempotent_methods = frozenset()
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
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics] | Response[DetailResponse]:
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

    def _download(
        self, artifact: PreprodArtifact
    ) -> StreamingHttpResponse | Response[DetailResponse]:
        session = get_snapshot_storage(artifact.project)
        result = session.get(archive_object_key(artifact.id))
        if result is None:
            return Response({"detail": "Download not ready"}, status=409)

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
        session = get_snapshot_storage(artifact.project)
        try:
            return archive_exists(session, archive_object_key(artifact.id))
        except RequestError:
            return False

    @extend_schema(
        operation_id="getOrganizationPreprodSnapshotArchiveStatus",
        summary="Retrieve a Snapshot Archive's Status",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SNAPSHOT_ID_PARAMETER],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SnapshotArchiveStatusResponse", SnapshotArchiveStatusResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.SNAPSHOT_ARCHIVE_STATUS,
    )
    def get(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> Response[SnapshotArchiveStatusResponse] | Response[DetailResponse] | StreamingHttpResponse:
        """
        Check whether the zip archive of a snapshot's images is ready to download.

        Start building the archive with a POST to this endpoint. Returns 404 when the
        snapshot doesn't exist, the requester can't access its project, or it has no image
        manifest.
        """
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        artifact, _metrics = resolved

        # `?download` streams the zip itself. It's left out of the published schema: the
        # CLI uses it as a binary transport, and the schema only describes JSON responses.
        if request.GET.get("download") is not None:
            analytics.record(
                PreprodArtifactApiSnapshotArchiveDownloadEvent(
                    organization_id=organization.id,
                    project_id=artifact.project_id,
                    user_id=acting_user_id(request.user),
                    artifact_id=str(artifact.id),
                    client=resolve_action_source(request),
                )
            )
            return self._download(artifact)

        # Readiness probe (no side effect): lets the UI download a ready archive
        # directly instead of re-triggering a build.
        status: SnapshotArchiveStatusResponse = {"ready": self._archive_exists(artifact)}
        return Response(status)

    @extend_schema(
        operation_id="startOrganizationPreprodSnapshotArchive",
        summary="Build a Snapshot Archive",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SNAPSHOT_ID_PARAMETER],
        request=None,
        responses={
            202: inline_sentry_response_serializer(
                "SnapshotArchiveBuildResponse", SnapshotArchiveBuildResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            429: RESPONSE_TOO_MANY_REQUESTS,
        },
        examples=PreprodExamples.START_SNAPSHOT_ARCHIVE,
    )
    def post(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> Response[SnapshotArchiveBuildResponse] | Response[DetailResponse]:
        """
        Start building a zip archive of a snapshot's images and its manifest.

        The archive is built in the background, and the requesting user gets an email with
        a download link when it's ready. Poll the GET method of this endpoint to see when it's
        ready. Each request starts another build and sends another email.

        Returns 404 when the snapshot doesn't exist, the requester can't access its project,
        or it has no image manifest, and 503 when the build couldn't be queued.
        """
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        artifact, _metrics = resolved
        # A caller with no user, such as a service account, gets no email.
        user_id = acting_user_id(request.user)
        try:
            build_snapshot_images_zip.apply_async(
                kwargs={
                    "org_id": artifact.project.organization_id,
                    "project_id": artifact.project_id,
                    "artifact_id": artifact.id,
                    "user_id": user_id,
                    # TODO: Remove after this change has been fully deployed.
                    "include_manifest": True,
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
        started: SnapshotArchiveBuildResponse = {
            "detail": "Building your snapshot archive — we'll email you a download "
            "link when it's ready."
        }
        return Response(started, status=202)
