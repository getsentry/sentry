from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

import orjson
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.constants import DataCategory
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

logger = logging.getLogger(__name__)


@dataclass
class CleanupStats:
    size_metrics_total_deleted: int = 0
    size_comparisons_total_deleted: int = 0
    files_total_deleted: int = 0


@region_silo_endpoint
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

        org_id = head_artifact.project.organization_id
        has_size_quota = quotas.backend.has_usage_quota(org_id, DataCategory.SIZE_ANALYSIS)
        has_installable_quota = quotas.backend.has_usage_quota(
            org_id, DataCategory.INSTALLABLE_BUILD
        )

        # Empty list is valid - triggers default processing behavior
        requested_features: list[PreprodFeature] = []
        if has_size_quota:
            requested_features.append(PreprodFeature.SIZE_ANALYSIS)
        if has_installable_quota:
            requested_features.append(PreprodFeature.BUILD_DISTRIBUTION)

        if PreprodFeature.SIZE_ANALYSIS in requested_features:
            cleanup_old_metrics(head_artifact)
        reset_artifact_data(head_artifact)

        try:
            produce_preprod_artifact_to_kafka(
                project_id=head_artifact.project.id,
                organization_id=org_id,
                artifact_id=head_artifact_id,
                requested_features=requested_features,
            )
        except Exception:
            logger.exception(
                "preprod_artifact.rerun_analysis.kafka_error",
                extra={
                    "artifact_id": head_artifact_id,
                    "user_id": request.user.id,
                    "organization_id": head_artifact.project.organization_id,
                    "project_id": head_artifact.project.id,
                },
            )
            return Response(
                {
                    "error": f"Failed to queue analysis for artifact {head_artifact_id}",
                },
                status=500,
            )

        logger.info(
            "preprod_artifact.rerun_analysis",
            extra={
                "artifact_id": head_artifact_id,
                "user_id": request.user.id,
                "organization_id": head_artifact.project.organization_id,
                "project_id": head_artifact.project.id,
            },
        )

        return success_response(
            artifact_id=str(head_artifact_id),
            state=head_artifact.state,
        )


@region_silo_endpoint
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
            return Response({"error": "Invalid JSON body"}, status=400)

        preprod_artifact_id = data.get("preprod_artifact_id")
        try:
            preprod_artifact_id = int(preprod_artifact_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "preprod_artifact_id is required and must be a valid integer"},
                status=400,
            )

        try:
            preprod_artifact = PreprodArtifact.objects.get(id=preprod_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"error": f"Preprod artifact {preprod_artifact_id} not found"}, status=404
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

        try:
            # Admin endpoint bypasses quota checks and requests all features
            produce_preprod_artifact_to_kafka(
                project_id=preprod_artifact.project.id,
                organization_id=preprod_artifact.project.organization_id,
                artifact_id=preprod_artifact_id,
                requested_features=[
                    PreprodFeature.SIZE_ANALYSIS,
                    PreprodFeature.BUILD_DISTRIBUTION,
                ],
            )
        except Exception as e:
            logger.exception(
                "preprod_artifact.admin_rerun_analysis.kafka_error",
                extra={
                    "artifact_id": preprod_artifact_id,
                    "user_id": request.user.id,
                    "organization_id": preprod_artifact.project.organization_id,
                    "project_id": preprod_artifact.project.id,
                    "error": str(e),
                },
            )
            return Response(
                {
                    "error": f"Failed to queue analysis for artifact {preprod_artifact_id}",
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
            stats.files_total_deleted, _ = File.objects.filter(id__in=file_ids_to_delete).delete()

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
    preprod_artifact.save(update_fields=["state", "error_code", "error_message", "date_updated"])


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
