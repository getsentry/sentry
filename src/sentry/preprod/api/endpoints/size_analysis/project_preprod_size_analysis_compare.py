import logging

from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisCompareResponse,
    SizeAnalysisComparison,
)
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeComparison
from sentry.preprod.size_analysis.tasks import manual_size_analysis_comparison
from sentry.preprod.size_analysis.utils import build_size_metrics_map

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisCompareEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self, request: Request, project, head_artifact_id, base_artifact_id
    ) -> HttpResponseBase:
        """
        Download size analysis results for a preprod artifact
        ````````````````````````````````````````````````````

        Download the size analysis comparison results for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string artifact_id: the ID of the preprod artifact to download size analysis for.
        :auth: required
        """

        try:
            head_preprod_artifact = PreprodArtifact.objects.get(id=head_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} does not exist."},
                status=404,
            )

        try:
            base_preprod_artifact = PreprodArtifact.objects.get(id=base_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} does not exist."},
                status=404,
            )

        head_metrics_map = build_size_metrics_map(head_preprod_artifact.size_metrics.all())
        base_metrics_map = build_size_metrics_map(base_preprod_artifact.size_metrics.all())

        comparisons: list[SizeAnalysisComparison] = []
        for key, head_metric in head_metrics_map.items():
            base_metric = base_metrics_map.get(key)

            if not base_metric:
                # No matching base metric, so we can't compare
                comparisons.append(
                    SizeAnalysisComparison(
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        comparison_id=None,
                        error_code="NO_BASE_METRIC",
                        error_message="No matching base artifact size metric found.",
                    )
                )
                continue

            # Try to find a comparison object
            comparison_obj = PreprodArtifactSizeComparison.objects.filter(
                head_size_analysis=head_metric,
                base_size_analysis=base_metric,
            ).first()

            if comparison_obj is None:
                # No comparison has been run yet
                comparisons.append(
                    SizeAnalysisComparison(
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.PENDING,
                        comparison_id=None,
                        error_code=None,
                        error_message=None,
                    )
                )
                continue

            if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
                comparisons.append(
                    SizeAnalysisComparison(
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
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.PROCESSING,
                        comparison_id=comparison_obj.id,
                        error_code=None,
                        error_message=None,
                    )
                )

        response = SizeAnalysisCompareResponse(
            head_artifact_id=int(head_artifact_id),
            base_artifact_id=int(base_artifact_id),
            comparisons=comparisons,
        )
        return Response(response.model_dump())

    def post(
        self, request: Request, project, head_artifact_id, base_artifact_id
    ) -> HttpResponseBase:
        """
        Compare size analysis results for a preprod artifact
        ````````````````````````````````````````````````````

        Compare the size analysis results for a preprod artifact.
        """

        try:
            head_preprod_artifact = PreprodArtifact.objects.get(id=head_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} does not exist."},
                status=404,
            )
        try:
            base_preprod_artifact = PreprodArtifact.objects.get(id=base_artifact_id)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} does not exist."},
                status=404,
            )

        # TODO: Handle:
        # non matching head or base metrics
        # non completed size analysis
        # Comparison already exists

        head_metrics_map = build_size_metrics_map(head_preprod_artifact.size_metrics.all())
        base_metrics_map = build_size_metrics_map(base_preprod_artifact.size_metrics.all())

        for key, head_metric in head_metrics_map.items():
            base_metric = base_metrics_map.get(key)
            if not base_metric:
                logger.info(
                    "preprod.size_analysis.compare.api.no_matching_base_metric",
                    extra={"head_metric_id": head_metric.id, "base_metric_id": base_metric.id},
                )
                continue

            manual_size_analysis_comparison(head_metric, base_metric)
