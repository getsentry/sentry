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
    SnapshotDiffPair,
    SnapshotImageResponse,
)
from sentry.preprod.api.schemas import VCS_ERROR_MESSAGES, VCS_SCHEMA_PROPERTIES
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.tasks import compare_snapshots
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

        comparison_data = None
        base_manifest_data = None
        comparison = (
            PreprodSnapshotComparison.objects.select_related(
                "base_snapshot_metrics",
            )
            .filter(
                head_snapshot_metrics=snapshot_metrics,
                state=PreprodSnapshotComparison.State.SUCCESS,
            )
            .first()
        )
        if comparison:
            comparison_key = (comparison.extras or {}).get("comparison_key")
            if comparison_key:
                try:
                    comparison_data = orjson.loads(session.get(comparison_key).payload.read())
                    comparison_data["baseArtifactId"] = str(
                        comparison.base_snapshot_metrics.preprod_artifact_id
                    )
                except Exception:
                    comparison_data = None
                    logger.exception(
                        "Failed to fetch comparison manifest",
                        extra={
                            "preprod_artifact_id": artifact.id,
                        },
                    )

            if comparison_data is not None:
                base_manifest_key = (comparison.base_snapshot_metrics.extras or {}).get(
                    "manifest_key"
                )
                if base_manifest_key:
                    try:
                        base_manifest_data = orjson.loads(
                            session.get(base_manifest_key).payload.read()
                        )
                    except Exception:
                        base_manifest_data = None
                        logger.exception(
                            "Failed to fetch base manifest",
                            extra={"preprod_artifact_id": artifact.id},
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

        images_by_file_name: dict[str, SnapshotImageResponse] = {
            img.image_file_name: img for img in image_list
        }

        changed: list[SnapshotDiffPair] = []
        added: list[SnapshotImageResponse] = []
        removed: list[SnapshotImageResponse] = []
        unchanged: list[SnapshotImageResponse] = []
        base_artifact_id: str | None = None
        comparison_state: str | None = None

        if comparison_data is not None:
            base_artifact_id = comparison_data.get("baseArtifactId")
            comp_images = comparison_data.get("images", {})

            raw_base_images = base_manifest_data.get("images", {}) if base_manifest_data else {}
            base_images_by_file_name: dict[str, SnapshotImageResponse] = {}
            for key, meta in raw_base_images.items():
                fname = meta.get("image_file_name", meta.get("file_name", key))
                base_images_by_file_name[fname] = SnapshotImageResponse(
                    key=key,
                    display_name=meta.get("display_name"),
                    image_file_name=fname,
                    width=meta.get("width", 0),
                    height=meta.get("height", 0),
                )

            for name, img_data in sorted(comp_images.items()):
                status = img_data.get("status", "")

                head_img = images_by_file_name.get(name)
                base_img = base_images_by_file_name.get(name)

                if status == "changed":
                    if head_img:
                        if not base_img:
                            base_img = SnapshotImageResponse(
                                key=img_data.get("base_hash", ""),
                                display_name=name,
                                image_file_name=name,
                                width=img_data.get("before_width", 0),
                                height=img_data.get("before_height", 0),
                            )
                        changed.append(
                            SnapshotDiffPair(
                                base_image=base_img,
                                head_image=head_img,
                                diff_image_key=img_data.get("diff_mask_image_id"),
                                diff=img_data.get("diff_score"),
                            )
                        )
                elif status == "added":
                    if head_img:
                        added.append(head_img)
                elif status == "removed":
                    if base_img:
                        removed.append(base_img)
                    else:
                        removed.append(
                            SnapshotImageResponse(
                                key=img_data.get("base_hash", ""),
                                display_name=name,
                                image_file_name=name,
                                width=img_data.get("before_width", 0),
                                height=img_data.get("before_height", 0),
                            )
                        )
                elif status == "unchanged":
                    if head_img:
                        unchanged.append(head_img)

            changed.sort(key=lambda p: p.diff or 0, reverse=True)
        else:
            pending_state = (
                PreprodSnapshotComparison.objects.filter(
                    head_snapshot_metrics=snapshot_metrics,
                    state__in=[
                        PreprodSnapshotComparison.State.PENDING,
                        PreprodSnapshotComparison.State.PROCESSING,
                    ],
                )
                .values_list("state", flat=True)
                .first()
            )
            if pending_state is not None:
                state_label = {
                    PreprodSnapshotComparison.State.PENDING: "pending",
                    PreprodSnapshotComparison.State.PROCESSING: "processing",
                }
                comparison_state = state_label.get(
                    PreprodSnapshotComparison.State(pending_state), "pending"
                )

        comparison_type = "diff" if comparison_data is not None else "solo"

        def on_results(images: list[SnapshotImageResponse]) -> dict[str, Any]:
            response = SnapshotDetailsApiResponse(
                head_artifact_id=str(artifact.id),
                base_artifact_id=base_artifact_id,
                state=artifact.state,
                vcs_info=vcs_info,
                images=images,
                image_count=snapshot_metrics.image_count,
                changed=changed,
                changed_count=len(changed),
                added=added,
                added_count=len(added),
                removed=removed,
                removed_count=len(removed),
                unchanged=unchanged,
                unchanged_count=len(unchanged),
            )

            result = response.dict()
            result["orgId"] = str(project.organization_id)
            result["projectId"] = str(project.id)
            result["comparison_type"] = comparison_type
            if comparison_state is not None:
                result["comparison_state"] = comparison_state

            return result

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

        if base_sha and base_repo_name:
            try:
                base_commit_comparison = CommitComparison.objects.get(
                    organization_id=project.organization_id,
                    head_sha=base_sha,
                    head_repo_name=base_repo_name,
                    base_sha__isnull=True,
                )
                base_artifact = (
                    PreprodArtifact.objects.filter(
                        commit_comparison=base_commit_comparison,
                        project=project,
                        preprodsnapshotmetrics__isnull=False,
                    )
                    .order_by("-date_added")
                    .first()
                )
                if base_artifact:
                    logger.info(
                        "Found matching base artifact, triggering snapshot comparison",
                        extra={
                            "head_artifact_id": artifact.id,
                            "base_artifact_id": base_artifact.id,
                            "base_sha": base_sha,
                        },
                    )

                    compare_snapshots.apply_async(
                        kwargs={
                            "project_id": project.id,
                            "org_id": project.organization_id,
                            "head_artifact_id": artifact.id,
                            "base_artifact_id": base_artifact.id,
                        },
                    )
            except CommitComparison.DoesNotExist:
                logger.info(
                    "No matching base commit found for snapshot comparison",
                    extra={
                        "head_artifact_id": artifact.id,
                        "base_sha": base_sha,
                        "base_repo_name": base_repo_name,
                        "base_ref": base_ref,
                    },
                )
            except Exception:
                logger.exception(
                    "Failed to trigger snapshot comparison",
                    extra={
                        "head_artifact_id": artifact.id,
                        "base_sha": base_sha,
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
