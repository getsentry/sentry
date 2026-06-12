from __future__ import annotations

import logging
from typing import Any, cast

import orjson
from django.conf import settings
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
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
from sentry.api.helpers.projects import (
    PROJECT_ID_OR_SLUG_SCHEMA,
    ProjectIdOrSlugField,
)
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.staff import is_active_staff
from sentry.constants import ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG, ObjectStatus
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.api.endpoints.snapshots.preprod_artifact_snapshot import (
    _strip_to_compact,
    build_snapshot_image_response,
)
from sentry.preprod.api.models.public.snapshots import LatestBaseSnapshotResponseDict
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
        "type": "integer|string",
        "required": False,
        "description": "Project ID or slug to scope the lookup when app_id is not unique across projects or project inference is unavailable.",
    },
    "projectSlug": {
        "type": "string",
        "required": False,
        "description": "Project slug to scope the lookup. Use either projectSlug or project when app_id is not unique across projects or project inference is unavailable.",
    },
}


@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class OrganizationPreprodLatestBaseSnapshotEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationReleasePermission,)

    @extend_schema(
        operation_id="Retrieve latest base Snapshot",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="app_id",
                type=str,
                location="query",
                required=True,
                description="App identifier to match.",
            ),
            OpenApiParameter(
                name="branch",
                type=str,
                location="query",
                required=False,
                description="Git branch name to filter on.",
            ),
            OpenApiParameter(
                name="project",
                type=PROJECT_ID_OR_SLUG_SCHEMA,
                location="query",
                required=False,
                description="Project ID or slug to scope the lookup.",
            ),
            OpenApiParameter(
                name="compact_metadata",
                type=str,
                location="query",
                required=False,
                description="Set to '1' or 'true' to strip image metadata to display_name, image_file_name, group, description, and image_url only.",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "LatestBaseSnapshotResponse", LatestBaseSnapshotResponseDict
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.GET_LATEST_BASE_SNAPSHOT,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
    ) -> Response[LatestBaseSnapshotResponseDict] | Response[DetailResponse]:
        """
        Retrieve the most recent base snapshot for a given app.

        A base snapshot is one uploaded without a `base_sha` (i.e., a snapshot
        from a base branch like `main`). Use the optional `branch` and `project`
        parameters to narrow the search.

        The response includes the full image list with download URLs. Use
        `compact_metadata=1` to reduce image metadata.

        This endpoint requires a bearer token with `project:read` access.
        """
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

        # This is a single-project lookup: projectSlug wins, and all-project sentinels are invalid.
        project_id = None
        project_slug = None
        if project_slug_param := request.GET.get("projectSlug"):
            if project_slug_param in (str(ALL_ACCESS_PROJECT_ID), ALL_ACCESS_PROJECTS_SLUG):
                return Response({"detail": "Invalid project parameter"}, status=400)
            project_slug = project_slug_param
        elif project_param := request.GET.get("project"):
            try:
                project_id_or_slug = ProjectIdOrSlugField().run_validation(project_param)
            except ValidationError:
                return Response({"detail": "Invalid project parameter"}, status=400)
            if project_id_or_slug in (ALL_ACCESS_PROJECT_ID, ALL_ACCESS_PROJECTS_SLUG):
                return Response({"detail": "Invalid project parameter"}, status=400)
            if isinstance(project_id_or_slug, int):
                project_id = project_id_or_slug
            else:
                project_slug = project_id_or_slug

        qs = (
            PreprodArtifact.objects.filter(
                project__organization_id=organization.id,
                project__status=ObjectStatus.ACTIVE,
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

        if not is_active_staff(request) and not request.access.has_global_access:
            qs = qs.filter(project_id__in=request.access.accessible_project_ids)

        if project_id is not None:
            qs = qs.filter(project_id=project_id)
        if project_slug is not None:
            qs = qs.filter(project__slug=project_slug)
        if branch:
            qs = qs.filter(commit_comparison__head_ref=branch)

        artifact = qs.order_by("-date_added").first()

        if artifact is None:
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

        # cast() sanctioned: response_data is a hand-built dict[str, Any] whose
        # shape mirrors LatestBaseSnapshotResponseDict. The TypedDict and the
        # builder are kept in sync by hand at the source of truth.
        body = cast(LatestBaseSnapshotResponseDict, response_data)
        return Response(body)
