from __future__ import annotations

import logging
from typing import Any

import orjson
from django.conf import settings
from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    NoProjects,
    OrganizationEndpoint,
    OrganizationReleasePermission,
)
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.api.endpoints.preprod_artifact_snapshot import (
    _strip_to_compact,
    build_snapshot_image_response,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import SnapshotManifest

logger = logging.getLogger(__name__)

LATEST_BASE_SNAPSHOT_GET_QUERY_PARAMS: dict[str, Any] = {
    "app_id": {"type": "string", "required": True, "description": "App identifier to match"},
    "branch": {
        "type": "string",
        "required": False,
        "description": "Git branch name (filters on commit_comparison.head_ref)",
    },
    "compact_metadata": {
        "type": "string",
        "required": False,
        "default": "0",
        "description": "Set to '1' or 'true' to strip image metadata to display_name, image_file_name, group, description",
    },
    "project": {
        "type": "integer",
        "required": False,
        "description": "Project ID to scope the lookup; recommended since app_id may not be unique across projects",
    },
}


@cell_silo_endpoint
class OrganizationPreprodLatestBaseSnapshotEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationReleasePermission,)

    def get(
        self,
        request: Request,
        organization: Organization,
    ) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        for param, spec in LATEST_BASE_SNAPSHOT_GET_QUERY_PARAMS.items():
            if spec.get("required") and not request.GET.get(param):
                return Response({"detail": f"{param} query parameter is required"}, status=400)

        app_id = request.GET.get("app_id")

        branch = request.GET.get("branch")
        compact = request.GET.get("compact_metadata", "0") in ("1", "true")

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return Response({"detail": "No snapshot found"}, status=404)

        qs = (
            PreprodArtifact.objects.filter(
                project__organization_id=organization.id,
                project_id__in=params["project_id"],
                app_id=app_id,
                preprodsnapshotmetrics__isnull=False,
            )
            .filter(
                Q(commit_comparison__isnull=True)
                | Q(commit_comparison__base_sha__isnull=True)
                | Q(commit_comparison__base_sha="")
            )
            .select_related("commit_comparison", "project", "preprodsnapshotmetrics")
        )

        if branch:
            qs = qs.filter(commit_comparison__head_ref=branch)

        artifact = qs.order_by("-date_added").first()

        if artifact is None:
            return Response({"detail": "No snapshot found"}, status=404)

        if not is_active_staff(request) and not request.access.has_project_access(artifact.project):
            return Response({"detail": "No snapshot found"}, status=404)

        snapshot_metrics = artifact.preprodsnapshotmetrics
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

        image_base_url = f"/api/0/projects/{organization.slug}/{artifact.project.slug}/files/images"

        images = []
        for key, metadata in sorted(manifest.images.items()):
            img = build_snapshot_image_response(key, metadata, manifest.diff_threshold).dict()
            img["image_url"] = f"{image_base_url}/{metadata.content_hash}/"
            images.append(img)

        response_data: dict[str, Any] = {
            "head_artifact_id": str(artifact.id),
            "project_id": str(artifact.project_id),
            "project_slug": artifact.project.slug,
            "app_id": artifact.app_id,
            "image_count": snapshot_metrics.image_count,
            "images": images,
            "diff_threshold": manifest.diff_threshold,
            "date_added": artifact.date_added.isoformat(),
        }

        cc = artifact.commit_comparison
        if cc:
            response_data["vcs_info"] = {
                "head_sha": cc.head_sha,
                "base_sha": cc.base_sha,
                "head_ref": cc.head_ref,
                "base_ref": cc.base_ref,
                "head_repo_name": cc.head_repo_name,
                "pr_number": cc.pr_number,
            }

        if compact:
            response_data["images"] = [
                {**_strip_to_compact(img), "image_url": img["image_url"]}
                for img in response_data["images"]
            ]

        return Response(response_data)
