from __future__ import annotations

import logging

import orjson
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationReleasePermission,
)
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot import (
    build_snapshot_image_response,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics

logger = logging.getLogger(__name__)


def _find_image_in_manifest(
    manifest: SnapshotManifest, identifier: str
) -> tuple[str | None, ImageMetadata | None]:
    if identifier in manifest.images:
        return identifier, manifest.images[identifier]
    for fname, meta in manifest.images.items():
        if meta.content_hash == identifier:
            return fname, meta
    return None, None


@cell_silo_endpoint
class OrganizationPreprodSnapshotImageDetailEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationReleasePermission,)

    def get(
        self,
        request: Request,
        organization: Organization,
        snapshot_id: str,
        image_identifier: str,
    ) -> Response:
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
            snapshot_metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
        if not manifest_key:
            return Response({"detail": "Manifest key not found"}, status=404)

        try:
            session = get_preprod_session(organization.id, artifact.project_id)
            manifest_data = orjson.loads(session.get(manifest_key).payload.read())
            manifest = SnapshotManifest(**manifest_data)
        except Exception:
            logger.exception(
                "Failed to retrieve snapshot manifest",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "manifest_key": manifest_key,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)

        image_file_name, metadata = _find_image_in_manifest(manifest, image_identifier)
        if metadata is None or image_file_name is None:
            return Response({"detail": "Image not found in snapshot"}, status=404)

        image_response = build_snapshot_image_response(
            image_file_name, metadata, manifest.diff_threshold
        )
        image_url = f"/api/0/projects/{organization.slug}/{artifact.project.slug}/files/images/{metadata.content_hash}/"

        return Response({**image_response.dict(), "image_url": image_url})
