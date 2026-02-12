from __future__ import annotations

import logging
from typing import Any

import jsonschema
import orjson
from django.conf import settings
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session
from sentry.preprod.api.schemas import VCS_ERROR_MESSAGES, VCS_SCHEMA_PROPERTIES
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

SNAPSHOT_REQUEST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "app_id": {"type": "string", "maxLength": 255},
        "images": {
            "type": "object",
            "additionalProperties": ImageMetadata.schema(),
            "maxProperties": 1000,
        },
        **VCS_SCHEMA_PROPERTIES,
    },
    "required": ["app_id", "images"],
    "additionalProperties": True,
}

SNAPSHOT_REQUEST_ERROR_MESSAGES: dict[str, str] = {
    "app_id": "The app_id field is required and must be a string with maximum length of 255 characters.",
    "images": "The images field is required and must be an object mapping image names to image metadata.",
    **VCS_ERROR_MESSAGES,
}


def validate_preprod_snapshot_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, SNAPSHOT_REQUEST_SCHEMA)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
        if e.path:
            if field := e.path[0]:
                error_message = SNAPSHOT_REQUEST_ERROR_MESSAGES.get(str(field), error_message)
        return {}, error_message
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"


@region_silo_endpoint
class ProjectPreprodSnapshotEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectReleasePermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    def get(self, request: Request, project: Project, snapshot_id: str) -> Response:
        """
        Retrieves snapshot data
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            offset = int(request.GET.get("offset", "0"))
            limit = int(request.GET.get("limit", "20"))
        except ValueError:
            return Response({"detail": "Invalid offset or limit parameter"}, status=400)

        if offset < 0 or limit <= 0 or limit > 100:
            return Response(
                {"detail": "offset must be >= 0, limit must be > 0 and <= 100"}, status=400
            )

        return Response(
            {},
            status=200,
        )

    def post(self, request: Request, project: Project) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        data, error_message = validate_preprod_snapshot_schema(request.body)
        if error_message:
            return Response({"detail": error_message}, status=400)

        app_id = data.get("app_id")
        images = data.get("images", {})

        # VCS info
        head_sha = data.get("head_sha")
        base_sha = data.get("base_sha")
        provider = data.get("provider")
        head_repo_name = data.get("head_repo_name")
        head_ref = data.get("head_ref")
        base_repo_name = data.get("base_repo_name")
        base_ref = data.get("base_ref")
        pr_number = data.get("pr_number")

        with transaction.atomic(router.db_for_write(PreprodArtifact)):
            commit_comparison = None
            if head_sha and provider and head_repo_name and head_ref:
                commit_comparison, _ = CommitComparison.objects.get_or_create(
                    organization_id=project.organization_id,
                    head_repo_name=head_repo_name,
                    head_sha=head_sha,
                    base_sha=base_sha,
                    defaults={
                        "provider": provider,
                        "base_repo_name": base_repo_name,
                        "head_ref": head_ref,
                        "base_ref": base_ref,
                        "pr_number": pr_number,
                    },
                )

            artifact = PreprodArtifact.objects.create(
                project=project,
                state=PreprodArtifact.ArtifactState.UPLOADED,
                app_id=app_id,
                commit_comparison=commit_comparison,
            )

            manifest_key = f"{project.organization_id}/{project.id}/{artifact.id}/manifest.json"

            snapshot_metrics = PreprodSnapshotMetrics.objects.create(
                preprod_artifact=artifact,
                image_count=len(images),
                extras={"manifest_key": manifest_key},
            )

            # Write manifest inside the transaction so that a failed objectstore
            # write rolls back the DB records, ensuring both succeed or neither does.
            session = get_preprod_session(project.organization_id, project.id)
            manifest = SnapshotManifest(images=images)
            manifest_json = manifest.json(exclude_none=True)
            session.put(manifest_json.encode(), key=manifest_key)

        logger.info(
            "Created preprod artifact and stored snapshot manifest",
            extra={
                "preprod_artifact_id": artifact.id,
                "snapshot_metrics_id": snapshot_metrics.id,
                "project_id": project.id,
                "organization_id": project.organization_id,
                "head_sha": head_sha,
                "manifest_key": manifest_key,
                "image_count": len(images),
            },
        )

        return Response(
            {
                "artifactId": str(artifact.id),
                "snapshotMetricsId": str(snapshot_metrics.id),
                "imageCount": snapshot_metrics.image_count,
            },
            status=200,
        )
