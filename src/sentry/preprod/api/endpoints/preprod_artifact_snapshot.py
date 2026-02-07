from __future__ import annotations

import logging
from io import BytesIO
from typing import Any

import jsonschema
import orjson
import sentry_sdk
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
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.api.schemas import VCS_SCHEMA_PROPERTIES
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.json import dumps_htmlsafe

logger = logging.getLogger(__name__)

# Shared base properties for all image manifest types
BASE_IMAGE_PROPERTIES: dict[str, Any] = {
    "fileName": {"type": "string"},
    "groupName": {"type": ["string", "null"]},
    "displayName": {"type": ["string", "null"]},
    "precision": {"type": ["integer", "null"], "minimum": 0},
    "width": {"type": "integer", "minimum": 0},
    "height": {"type": "integer", "minimum": 0},
    "imageId": {"type": ["string", "null"]},
}

BASE_IMAGE_REQUIRED = ["width", "height"]

BYO_IMAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        **BASE_IMAGE_PROPERTIES,
        "darkMode": {"type": "boolean"},
        "orientation": {"type": "string", "enum": ["landscape", "portrait"]},
        "device": {"type": "string"},
    },
    "required": [*BASE_IMAGE_REQUIRED, "orientation", "device"],
    "additionalProperties": False,
}

SNAPSHOT_IMAGE_SCHEMA: dict[str, Any] = {
    "anyOf": [
        BYO_IMAGE_SCHEMA,
        # Add other image schemas here as needed (e.g. iOS/Android/etc)
    ]
}


def validate_preprod_snapshot_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    schema = {
        "type": "object",
        "properties": {
            **VCS_SCHEMA_PROPERTIES,
            "images": {"type": "object", "additionalProperties": SNAPSHOT_IMAGE_SCHEMA},
        },
        "required": ["images"],
        "additionalProperties": True,
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
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
        Retrieves snapshot data with all shards and paginated images
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        try:
            offset = int(request.GET.get("offset", "0"))
            limit = int(request.GET.get("limit", "20"))
        except ValueError:
            return Response({"error": "Invalid offset or limit parameter"}, status=400)

        if offset < 0 or limit <= 0 or limit > 100:
            return Response(
                {"error": "offset must be >= 0, limit must be > 0 and <= 100"}, status=400
            )

        with sentry_sdk.start_span(op="preprod_artifact.get_snapshot_data"):
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

        images = data.get("images", [])

        # VCS info
        head_sha = data.get("head_sha")
        base_sha = data.get("base_sha")
        provider = data.get("provider")
        head_repo_name = data.get("head_repo_name")
        head_ref = data.get("head_ref")
        pr_number = data.get("pr_number")

        with transaction.atomic(router.db_for_write(PreprodArtifact)):
            # Create CommitComparison if VCS info is provided
            commit_comparison = None
            if head_sha and provider and head_repo_name and head_ref:
                commit_comparison, _ = CommitComparison.objects.get_or_create(
                    organization_id=project.organization_id,
                    head_sha=head_sha.lower(),
                    base_sha=base_sha.lower() if base_sha else None,
                    provider=provider,
                    head_repo_name=head_repo_name,
                    base_repo_name=head_repo_name,
                    head_ref=head_ref,
                    base_ref=None,
                    pr_number=pr_number,
                )

            # Create new PreprodArtifact for snapshots
            artifact = PreprodArtifact.objects.create(
                project=project,
                state=PreprodArtifact.ArtifactState.UPLOADED,
                commit_comparison=commit_comparison,
            )

            # Get or create PreprodSnapshotMetrics
            snapshot_metrics, created = PreprodSnapshotMetrics.objects.get_or_create(
                preprod_artifact=artifact,
                defaults={
                    "image_count": len(images),
                },
            )

            logger.info(
                "Created preprod artifact for snapshots",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "project_id": project.id,
                    "organization_id": project.organization_id,
                    "head_sha": head_sha,
                },
            )

            if not created:
                # Update existing metrics with this shard's data
                extras = snapshot_metrics.extras or {}

                snapshot_metrics.image_count += len(images)
                snapshot_metrics.extras = extras
                snapshot_metrics.save(update_fields=["image_count", "extras"])

            # Store manifest data in object store
            manifest_data = {
                "images": images,
            }

            manifest_file = File.objects.create(
                name="snapshot.json",
                type="preprod.snapshot_manifest",
                headers={"Content-Type": "application/json"},
            )
            manifest_file.putfile(BytesIO(dumps_htmlsafe(manifest_data).encode()))

            # Store manifest file reference in extras
            extras = snapshot_metrics.extras or {}
            manifest_files = extras.get("manifest_file_ids", {})
            shard_index = str(len(manifest_files))
            manifest_files[shard_index] = manifest_file.id
            extras["manifest_file_ids"] = manifest_files
            snapshot_metrics.extras = extras
            snapshot_metrics.save(update_fields=["extras"])

            logger.info(
                "Stored snapshot manifest",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "snapshot_metrics_id": snapshot_metrics.id,
                    "manifest_file_id": manifest_file.id,
                    "image_count": len(images),
                },
            )

            # Check if all shards have been received
            return Response(
                {
                    "artifactId": str(artifact.id),
                    "snapshotMetricsId": str(snapshot_metrics.id),
                    "imageCount": snapshot_metrics.image_count,
                },
                status=201,
            )
