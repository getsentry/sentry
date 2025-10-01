import logging

import orjson
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.models.files.file import File
from sentry.preprod.analytics import PreprodArtifactApiRerunAnalysisEvent
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.producer import produce_preprod_artifact_to_kafka

logger = logging.getLogger(__name__)


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
            preprod_artifact_id_int = int(preprod_artifact_id)
        except ValueError:
            return Response(
                {"error": f"Invalid preprod artifact ID: {preprod_artifact_id}"}, status=400
            )

        if not preprod_artifact_id:
            return Response({"error": "preprod_artifact_id is required"}, status=400)

        try:
            preprod_artifact = PreprodArtifact.objects.get(id=preprod_artifact_id_int)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"error": f"Preprod artifact {preprod_artifact_id} not found"}, status=404
            )

        analytics.record(
            PreprodArtifactApiRerunAnalysisEvent(
                organization_id=preprod_artifact.project.organization_id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=preprod_artifact_id,
            )
        )

        # Clean up old metrics data before reprocessing
        cleanup_stats = self._cleanup_old_metrics(preprod_artifact)

        preprod_artifact.state = PreprodArtifact.ArtifactState.UPLOADED
        preprod_artifact.error_code = None
        preprod_artifact.error_message = None
        preprod_artifact.save(
            update_fields=["state", "error_code", "error_message", "date_updated"]
        )

        try:
            produce_preprod_artifact_to_kafka(
                project_id=preprod_artifact.project.id,
                organization_id=preprod_artifact.project.organization_id,
                artifact_id=preprod_artifact_id_int,
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
                "cleanup_stats": cleanup_stats,
            },
        )

        return Response(
            {
                "success": True,
                "artifact_id": preprod_artifact_id,
                "message": f"Analysis rerun initiated for artifact {preprod_artifact_id}",
                "new_state": preprod_artifact.state,
                "cleanup_stats": cleanup_stats,
            }
        )

    def _cleanup_old_metrics(self, preprod_artifact: PreprodArtifact) -> dict:
        """Deletes old size metrics and comparisons associated with an artifact along with any associated files."""

        # These stats include cascading delete counts as well
        stats = {
            "size_metrics_total_deleted": 0,
            "size_comparisons_total_deleted": 0,
            "files_total_deleted": 0,
        }

        size_metrics = list(
            PreprodArtifactSizeMetrics.objects.filter(preprod_artifact=preprod_artifact)
        )

        if not size_metrics:
            return stats

        size_metric_ids = [sm.id for sm in size_metrics]
        file_ids_to_delete = []

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

        with transaction.atomic(using=router.db_for_write(PreprodArtifact)):
            stats["size_comparisons_total_deleted"], _ = comparisons.delete()

            stats["size_metrics_total_deleted"], _ = PreprodArtifactSizeMetrics.objects.filter(
                id__in=size_metric_ids
            ).delete()

        if file_ids_to_delete:
            stats["files_total_deleted"], _ = File.objects.filter(
                id__in=file_ids_to_delete
            ).delete()

        return stats
