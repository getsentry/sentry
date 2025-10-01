import logging

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.preprod.analytics import PreprodArtifactApiSizeAnalysisCompareGetEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisCompareGETResponse,
    SizeAnalysisComparison,
)
from sentry.preprod.models import PreprodArtifactSizeComparison, PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.utils import build_size_metrics_map

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisCompareEndpoint(PreprodArtifactEndpoint):
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
        Get size analysis comparison results for a preprod artifact
        ````````````````````````````````````````````````````

        Get size analysis comparison results for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the head preprod artifact to get size analysis comparison for.
        :pparam string base_artifact_id: the ID of the base preprod artifact to get size analysis comparison for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisCompareGetEvent(
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
            "preprod.size_analysis.compare.api.get",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )

        if head_artifact.project.id != project.id:
            return Response({"error": "Project not found"}, status=404)

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        head_size_metrics = list(head_size_metrics_qs)

        if len(head_size_metrics) == 0:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} has no size metrics."},
                status=404,
            )

        if base_artifact.project.id != project.id:
            return Response({"error": "Project not found"}, status=404)

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        base_size_metrics = list(base_size_metrics_qs)

        if len(base_size_metrics) == 0:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} has no size metrics."},
                status=404,
            )

        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        comparisons: list[SizeAnalysisComparison] = []
        for key, head_metric in head_metrics_map.items():
            base_metric = base_metrics_map.get(key)

            if not base_metric:
                logger.info(
                    "preprod.size_analysis.compare.api.get.no_matching_base_metric",
                    extra={"head_metric_id": head_metric.id},
                )
                # No matching base metric, so we can't compare
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=None,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        comparison_id=None,
                        error_code="NO_BASE_METRIC",
                        error_message="No matching base artifact size metric found.",
                    )
                )
                continue

            logger.info(
                "preprod.size_analysis.compare.api.get.metrics",
                extra={"head_metric": head_metric, "base_metric": base_metric},
            )

            # Try to find a comparison object
            try:
                comparison_obj = PreprodArtifactSizeComparison.objects.get(
                    head_size_analysis_id=head_metric.id,
                    base_size_analysis_id=base_metric.id,
                )
            except PreprodArtifactSizeComparison.DoesNotExist:
                logger.info(
                    "preprod.size_analysis.compare.api.get.no_comparison_obj",
                    extra={"head_metric_id": head_metric.id, "base_metric_id": base_metric.id},
                )
                continue

            logger.info(
                "preprod.size_analysis.compare.api.get.comparison_obj",
                extra={"comparison_obj": comparison_obj},
            )

            if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.SUCCESS,
                        comparison_id=comparison_obj.id,
                        error_code=None,
                        error_message=None,
                    )
                )
            elif comparison_obj.state == PreprodArtifactSizeComparison.State.FAILED:
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        comparison_id=comparison_obj.id,
                        error_code=(
                            str(comparison_obj.error_code)
                            if comparison_obj.error_code is not None
                            else None
                        ),
                        error_message=comparison_obj.error_message,
                    )
                )
            else:
                # Still processing or pending
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.PROCESSING,
                        comparison_id=comparison_obj.id,
                        error_code=None,
                        error_message=None,
                    )
                )

        logger.info(
            "preprod.size_analysis.compare.api.get.success",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "comparisons": len(comparisons),
            },
        )
        head_build_details = transform_preprod_artifact_to_build_details(head_artifact)
        base_build_details = transform_preprod_artifact_to_build_details(base_artifact)
        response = SizeAnalysisCompareGETResponse(
            head_build_details=head_build_details,
            base_build_details=base_build_details,
            comparisons=comparisons,
        )
        return Response(response.dict())
