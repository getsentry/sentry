from __future__ import annotations

import logging
from typing import Any

import jsonschema
import orjson
from django.conf import settings
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.models.commitcomparison import CommitComparison
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session
from sentry.preprod.analytics import PreprodArtifactApiGetSnapshotDetailsEvent
from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsVcsInfo
from sentry.preprod.api.models.snapshots.project_preprod_snapshot_models import (
    SnapshotDetailsApiResponse,
    SnapshotImageResponse,
)
from sentry.preprod.api.schemas import VCS_ERROR_MESSAGES, VCS_SCHEMA_PROPERTIES
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SNAPSHOT_POST_REQUEST_SCHEMA: dict[str, Any] = {
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

SNAPSHOT_POST_REQUEST_ERROR_MESSAGES: dict[str, str] = {
    "app_id": "The app_id field is required and must be a string with maximum length of 255 characters.",
    "images": "The images field is required and must be an object mapping image names to image metadata.",
    **VCS_ERROR_MESSAGES,
}


def validate_preprod_snapshot_post_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, SNAPSHOT_POST_REQUEST_SCHEMA)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
        if e.path:
            if field := e.path[0]:
                error_message = SNAPSHOT_POST_REQUEST_ERROR_MESSAGES.get(str(field), error_message)
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
        Retrieves snapshot data including manifest images and VCS info.
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related("commit_comparison").get(
                id=snapshot_id, project_id=project.id
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            snapshot_metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
        if not manifest_key:
            return Response({"detail": "Manifest key not found"}, status=404)

        try:
            session = get_preprod_session(project.organization_id, project.id)
            get_response = session.get(manifest_key)
            manifest_data = orjson.loads(get_response.payload.read())
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

        # Build VCS info from commit_comparison
        commit_comparison = artifact.commit_comparison
        vcs_info = BuildDetailsVcsInfo(
            head_sha=commit_comparison.head_sha if commit_comparison else None,
            base_sha=commit_comparison.base_sha if commit_comparison else None,
            provider=commit_comparison.provider if commit_comparison else None,
            head_repo_name=commit_comparison.head_repo_name if commit_comparison else None,
            base_repo_name=commit_comparison.base_repo_name if commit_comparison else None,
            head_ref=commit_comparison.head_ref if commit_comparison else None,
            base_ref=commit_comparison.base_ref if commit_comparison else None,
            pr_number=commit_comparison.pr_number if commit_comparison else None,
        )

        analytics.record(
            PreprodArtifactApiGetSnapshotDetailsEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id if request.user and request.user.is_authenticated else None,
                artifact_id=str(artifact.id),
            )
        )

        image_list = [
            SnapshotImageResponse(
                key=key,
                display_name=metadata.display_name,
                image_file_name=metadata.image_file_name,
                width=metadata.width,
                height=metadata.height,
            )
            for key, metadata in sorted(manifest.images.items())
        ]

        def on_results(images: list[SnapshotImageResponse]) -> dict[str, Any]:
            return SnapshotDetailsApiResponse(
                head_artifact_id=str(artifact.id),
                state=artifact.state,
                vcs_info=vcs_info,
                images=images,
                image_count=snapshot_metrics.image_count,
            ).dict()

        return self.paginate(
            request=request,
            queryset=image_list,
            paginator_cls=OffsetPaginator,
            on_results=on_results,
            default_per_page=20,
            max_per_page=100,
        )

    def post(self, request: Request, project: Project) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        data, error_message = validate_preprod_snapshot_post_schema(request.body)
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

        # has_vcs tag differentiates transactions that include a CommitComparison
        # lookup from those that skip it, so we can isolate their latency on dashboards.
        with (
            metrics.timer(
                "preprod.snapshot.transaction_duration",
                sample_rate=1.0,
                tags={
                    "has_vcs": bool(head_sha and provider and head_repo_name and head_ref),
                    "organization_id_value": project.organization_id,
                },
            ),
            transaction.atomic(router.db_for_write(PreprodArtifact)),
        ):
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
