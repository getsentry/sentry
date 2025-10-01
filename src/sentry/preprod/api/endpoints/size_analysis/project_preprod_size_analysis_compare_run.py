import logging

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisCompareRunGetEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisCompareRunGETResponse,
    SizeAnalysisComparison,
)
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.tasks import manual_size_analysis_comparison
from sentry.preprod.size_analysis.utils import can_compare_size_metrics

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisCompareRunEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project,
        head_artifact_id,
        base_artifact_id,
        head_artifact,
        base_artifact,
    ) -> HttpResponseBase:
        """
        Run size analysis comparison for a preprod artifact
        ````````````````````````````````````````````````````

        Run size analysis comparison for a preprod artifact. Will run comparisons async for all size metrics.
        Intentionally a GET endpoint as users should be able to trigger comparisons without elevated project write permissions.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the head preprod artifact to trigger size analysis comparison for.
        :pparam string base_artifact_id: the ID of the base preprod artifact to trigger size analysis comparison for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisCompareRunGetEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                head_artifact_id=head_artifact_id,
                base_artifact_id=base_artifact_id,
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        logger.info(
            "preprod.size_analysis.compare.api.run.get",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )

        if head_artifact.build_configuration != base_artifact.build_configuration:
            return Response(
                {"error": "Head and base build configurations must be the same."}, status=400
            )

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")

        if head_size_metrics_qs.count() == 0:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} has no size metrics."},
                status=404,
            )

        # Check if any of the size metrics are not completed
        if (
            head_size_metrics_qs.filter(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ).count()
            == 0
        ):
            body = SizeAnalysisCompareRunGETResponse(
                status="processing",
                message=f"Head PreprodArtifact with id {head_artifact_id} has no completed size metrics yet. Size analysis may still be processing. Please try again later.",
            )
            return Response(
                body.dict(),
                status=202,  # Accepted, processing not complete
            )

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        if base_size_metrics_qs.count() == 0:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} has no size metrics."},
                status=404,
            )

        if (
            base_size_metrics_qs.filter(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ).count()
            == 0
        ):
            body = SizeAnalysisCompareRunGETResponse(
                status="processing",
                message=f"Base PreprodArtifact with id {base_artifact_id} has no completed size metrics yet. Size analysis may still be processing. Please try again later.",
            )
            return Response(
                body.dict(),
                status=202,  # Accepted, processing not complete
            )

        head_size_metrics = list(head_size_metrics_qs)
        base_size_metrics = list(base_size_metrics_qs)

        # Check if the size metrics can be compared
        if not can_compare_size_metrics(head_size_metrics, base_size_metrics):
            return Response(
                {"detail": "Head and base size metrics cannot be compared."},
                status=400,
            )

        existing_comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis__in=head_size_metrics,
            base_size_analysis__in=base_size_metrics,
        )
        if existing_comparisons.exists():
            # Build SizeAnalysisComparison models for each existing comparison
            comparison_models = []
            for comparison in existing_comparisons:
                comparison_models.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=comparison.head_size_analysis.id,
                        base_size_metric_id=comparison.base_size_analysis.id,
                        metrics_artifact_type=comparison.head_size_analysis.metrics_artifact_type,
                        identifier=comparison.head_size_analysis.identifier,
                        state=comparison.state,
                        comparison_id=(
                            comparison.id
                            if comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
                            else None
                        ),
                        error_code=(
                            str(comparison.error_code)
                            if comparison.state == PreprodArtifactSizeComparison.State.FAILED
                            and comparison.error_code is not None
                            else None
                        ),
                        error_message=(
                            comparison.error_message
                            if comparison.state == PreprodArtifactSizeComparison.State.FAILED
                            else None
                        ),
                    )
                )
            body = SizeAnalysisCompareRunGETResponse(
                status="exists",
                message="A comparison already exists for the head and base size metrics.",
                existing_comparisons=comparison_models,
            )
            return Response(body.dict(), status=200)

        logger.info(
            "preprod.size_analysis.compare.api.run.get.running_comparison",
            extra={"head_artifact_id": head_artifact.id, "base_artifact_id": base_artifact.id},
        )

        manual_size_analysis_comparison.apply_async(
            kwargs={
                "project_id": project.id,
                "org_id": project.organization_id,
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
            }
        )

        logger.info(
            "preprod.size_analysis.compare.api.run.get.success",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )
        return Response(status=200)
