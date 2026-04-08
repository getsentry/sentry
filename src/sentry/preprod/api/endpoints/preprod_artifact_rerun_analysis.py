from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import orjson
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint, internal_cell_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiRerunAnalysisEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.producer import PreprodFeature, produce_preprod_artifact_to_kafka
from sentry.preprod.quotas import should_run_distribution, should_run_size
from sentry.preprod.tasks import dispatch_taskbroker

logger = logging.getLogger(__name__)


@dataclass
class CleanupStats:
    size_metrics_total_deleted: int = 0
    size_comparisons_total_deleted: int = 0
    files_total_deleted: int = 0


@cell_silo_endpoint
class PreprodArtifactRerunAnalysisEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        User facing endpoint to rerun analysis for a specific preprod artifact.
        """

        analytics.record(
            PreprodArtifactApiRerunAnalysisEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=str(head_artifact_id),
            )
        )

        organization = head_artifact.project.organization

        # Empty list is valid - triggers default processing behavior
        requested_features: list[PreprodFeature] = []

        run_size, _ = should_run_size(head_artifact, actor=request.user)
        if run_size:
            requested_features.append(PreprodFeature.SIZE_ANALYSIS)

        run_distribution, _ = should_run_distribution(head_artifact, actor=request.user)
        if run_distribution:
            requested_features.append(PreprodFeature.BUILD_DISTRIBUTION)

        if PreprodFeature.SIZE_ANALYSIS in requested_features:
            cleanup_old_metrics(head_artifact)
        reset_artifact_data(head_artifact)

        if features.has("organizations:launchpad-taskbroker-rollout", organization):
            dispatched = dispatch_taskbroker(
                head_artifact.project.id, organization.id, head_artifact_id
            )
        else:
            try:
                produce_preprod_artifact_to_kafka(
                    project_id=head_artifact.project.id,
                    organization_id=organization.id,
                    artifact_id=head_artifact_id,
                    requested_features=requested_features,
                )
                dispatched = True
            except Exception:
                logger.exception(
                    "preprod_artifact.rerun_analysis.dispatch_error",
                    extra={
                        "artifact_id": head_artifact_id,
                        "user_id": request.user.id,
                        "organization_id": organization.id,
                        "project_id": head_artifact.project.id,
                    },
                )
                dispatched = False

        if not dispatched:
            return Response(
                {
                    "detail": f"Failed to queue analysis for artifact {head_artifact_id}",
                },
                status=500,
            )

        logger.info(
            "preprod_artifact.rerun_analysis",
            extra={
                "artifact_id": head_artifact_id,
                "user_id": request.user.id,
                "organization_id": organization.id,
                "project_id": head_artifact.project.id,
            },
        )

        return success_response(
            artifact_id=str(head_artifact_id),
            state=head_artifact.state,
        )


@internal_cell_silo_endpoint
class PreprodArtifactAdminRerunAnalysisEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        """
        Rerun analysis for a preprod artifact
        ```````````````````````````````````

        Admin endpoint to rerun analysis for a specific preprod artifact.
        This endpoint requires superuser privileges.

        :auth: required (superuser)
        """

        try:
            data = orjson.loads(request.body)
        except (orjson.JSONDecodeError, TypeError):
            return Response({"detail": "Invalid JSON body"}, status=400)

        preprod_artifact_id = data.get("preprod_artifact_id")
        try:
            preprod_artifact_id = int(preprod_artifact_id)
        except (ValueError, TypeError):
            return Response(
                {"detail": "preprod_artifact_id is required and must be a valid integer"},
                status=400,
            )

        try:
            preprod_artifact = PreprodArtifact.objects.get(id=preprod_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Preprod artifact {preprod_artifact_id} not found"}, status=404
            )

        analytics.record(
            PreprodArtifactApiRerunAnalysisEvent(
                organization_id=preprod_artifact.project.organization_id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=str(preprod_artifact_id),
            )
        )

        cleanup_stats = cleanup_old_metrics(preprod_artifact)
        reset_artifact_data(preprod_artifact)

        organization = preprod_artifact.project.organization
        if features.has("organizations:launchpad-taskbroker-rollout", organization):
            dispatched = dispatch_taskbroker(
                preprod_artifact.project.id, organization.id, preprod_artifact_id
            )
        else:
            try:
                produce_preprod_artifact_to_kafka(
                    project_id=preprod_artifact.project.id,
                    organization_id=organization.id,
                    artifact_id=preprod_artifact_id,
                    requested_features=[
                        PreprodFeature.SIZE_ANALYSIS,
                        PreprodFeature.BUILD_DISTRIBUTION,
                    ],
                )
                dispatched = True
            except Exception as e:
                logger.exception(
                    "preprod_artifact.admin_rerun_analysis.dispatch_error",
                    extra={
                        "artifact_id": preprod_artifact_id,
                        "user_id": request.user.id,
                        "organization_id": organization.id,
                        "project_id": preprod_artifact.project.id,
                        "error": str(e),
                    },
                )
                dispatched = False

        if not dispatched:
            return Response(
                {
                    "detail": f"Failed to queue analysis for artifact {preprod_artifact_id}",
                },
                status=500,
            )

        logger.info(
            "preprod_artifact.admin_rerun_analysis",
            extra={
                "artifact_id": preprod_artifact_id,
                "user_id": request.user.id,
                "organization_id": preprod_artifact.project.organization_id,
                "project_id": preprod_artifact.project.id,
                "cleanup_stats": asdict(cleanup_stats),
            },
        )

        return success_response(
            artifact_id=str(preprod_artifact_id),
            state=preprod_artifact.state,
            cleanup_stats=cleanup_stats,
        )


@internal_cell_silo_endpoint
class PreprodArtifactAdminBatchRerunAnalysisEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (StaffPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        try:
            data = orjson.loads(request.body)
        except (orjson.JSONDecodeError, TypeError):
            return Response({"detail": "Invalid JSON body"}, status=400)

        raw_ids = data.get("artifact_ids", [])
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response(
                {"detail": "artifact_ids is required and must be a non-empty list"},
                status=400,
            )

        try:
            artifact_ids = list(dict.fromkeys(int(aid) for aid in raw_ids))
        except (ValueError, TypeError):
            return Response(
                {"detail": "artifact_ids must be a list of integers"},
                status=400,
            )

        if len(artifact_ids) > 100:
            return Response(
                {"detail": "Cannot rerun analysis for more than 100 artifacts at once"},
                status=400,
            )

        artifacts = list(
            PreprodArtifact.objects.select_related("project__organization").filter(
                id__in=artifact_ids
            )
        )
        artifacts_by_id = {a.id: a for a in artifacts}

        missing_ids = set(artifact_ids) - set(artifacts_by_id.keys())
        if missing_ids:
            return Response(
                {"detail": f"Artifacts not found: {sorted(missing_ids)}"},
                status=404,
            )

        results: list[dict[str, object]] = []
        for artifact_id in artifact_ids:
            artifact = artifacts_by_id[artifact_id]
            organization = artifact.project.organization

            analytics.record(
                PreprodArtifactApiRerunAnalysisEvent(
                    organization_id=organization.id,
                    project_id=artifact.project.id,
                    user_id=request.user.id,
                    artifact_id=str(artifact_id),
                )
            )

            cleanup_stats = cleanup_old_metrics(artifact)
            reset_artifact_data(artifact)

            if features.has("organizations:launchpad-taskbroker-rollout", organization):
                dispatched = dispatch_taskbroker(artifact.project.id, organization.id, artifact_id)
            else:
                try:
                    produce_preprod_artifact_to_kafka(
                        project_id=artifact.project.id,
                        organization_id=organization.id,
                        artifact_id=artifact_id,
                        requested_features=[
                            PreprodFeature.SIZE_ANALYSIS,
                            PreprodFeature.BUILD_DISTRIBUTION,
                        ],
                    )
                    dispatched = True
                except Exception:
                    logger.exception(
                        "preprod_artifact.admin_batch_rerun_analysis.dispatch_error",
                        extra={
                            "artifact_id": artifact_id,
                            "user_id": request.user.id,
                            "organization_id": organization.id,
                            "project_id": artifact.project.id,
                        },
                    )
                    dispatched = False

            if not dispatched:
                artifact.refresh_from_db()

            result: dict[str, object] = {
                "artifact_id": str(artifact_id),
                "success": dispatched,
                "new_state": artifact.state,
                "cleanup_stats": asdict(cleanup_stats),
            }
            if not dispatched:
                result["detail"] = "Cleanup completed but dispatch failed"
            results.append(result)

            if dispatched:
                logger.info(
                    "preprod_artifact.admin_batch_rerun_analysis",
                    extra={
                        "artifact_id": artifact_id,
                        "user_id": request.user.id,
                        "organization_id": organization.id,
                        "project_id": artifact.project.id,
                        "cleanup_stats": asdict(cleanup_stats),
                    },
                )

        return Response({"results": results})


def cleanup_old_metrics(preprod_artifact: PreprodArtifact) -> CleanupStats:
    """Deletes old size metrics and comparisons associated with an artifact along with any associated files."""

    # These stats include cascading delete counts as well
    stats = CleanupStats()

    size_metrics = list(
        PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact)
    )

    file_ids_to_delete = []

    if size_metrics:
        size_metric_ids = [sm.id for sm in size_metrics]

        for size_metric in size_metrics:
            if size_metric.analysis_file_id:
                file_ids_to_delete.append(size_metric.analysis_file_id)

        comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis_id__in=size_metric_ids
        ) | PreprodArtifactSizeComparison.objects.filter(base_size_analysis_id__in=size_metric_ids)

        comparison_file_ids = list(
            comparisons.exclude(file_id__isnull=True).values_list("file_id", flat=True)
        )
        file_ids_to_delete.extend(comparison_file_ids)

        with transaction.atomic(using=router.db_for_write(PreprodArtifactSizeMetrics)):
            stats.size_comparisons_total_deleted, _ = comparisons.delete()

            stats.size_metrics_total_deleted, _ = PreprodArtifactSizeMetrics.objects.filter(
                id__in=size_metric_ids
            ).delete()

        if file_ids_to_delete:
            for file in File.objects.filter(id__in=file_ids_to_delete):
                file.delete()
                stats.files_total_deleted += 1

    PreprodArtifactSizeMetrics.objects.create(
        preprod_artifact=preprod_artifact,
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
    )

    return stats


def reset_artifact_data(preprod_artifact: PreprodArtifact) -> None:
    preprod_artifact.state = PreprodArtifact.ArtifactState.UPLOADED
    preprod_artifact.error_code = None
    preprod_artifact.error_message = None
    preprod_artifact.installable_app_error_code = None
    preprod_artifact.installable_app_error_message = None
    preprod_artifact.save(
        update_fields=[
            "state",
            "error_code",
            "error_message",
            "installable_app_error_code",
            "installable_app_error_message",
            "date_updated",
        ]
    )


def success_response(
    artifact_id: str,
    state: PreprodArtifact.ArtifactState,
    cleanup_stats: CleanupStats | None = None,
) -> Response:
    response_data = {
        "success": True,
        "artifact_id": artifact_id,
        "message": f"Analysis rerun initiated for artifact {artifact_id}",
        "new_state": state,
    }
    if cleanup_stats is not None:
        response_data["cleanup_stats"] = asdict(cleanup_stats)
    return Response(response_data)
