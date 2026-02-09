from __future__ import annotations

import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactEndpoint,
    PreprodArtifactResourceDoesNotExist,
)
from sentry.preprod.api.models.project_preprod_build_details_models import (
    create_build_details_app_info,
)
from sentry.preprod.api.models.public_api_models import (
    PublicComparisonResult,
    SizeAnalysisCompletedResponse,
    SizeAnalysisFailedResponse,
    SizeAnalysisNotRanResponse,
    SizeAnalysisPendingResponse,
    SizeAnalysisProcessingResponse,
    SizeAnalysisResponseDict,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import ComparisonResults, SizeAnalysisResults
from sentry.preprod.size_analysis.utils import build_size_metrics_map
from sentry.utils import json

logger = logging.getLogger(__name__)


@extend_schema(tags=["Builds"])
@region_silo_endpoint
class ProjectPreprodPublicSizeAnalysisEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve Size Analysis for a Build",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="head_artifact_id",
                description="The ID of the build artifact.",
                required=True,
                type=str,
                location="path",
            ),
            OpenApiParameter(
                name="base_id",
                description="Optional ID of the base artifact to compare against. If not provided, uses the default base from the commit comparison.",
                required=False,
                type=str,
                location="query",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SizeAnalysisResponse", SizeAnalysisResponseDict
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        Retrieve size analysis results for a build artifact.

        Returns size metrics including download size, install size, and optional insights.
        When a base artifact exists (either from commit comparison or via the base_id parameter),
        comparison data showing size differences is included.
        """

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        size_metrics = list(head_artifact.get_size_metrics())

        if not size_metrics:
            return Response({"detail": "Size analysis not available for this artifact"}, status=404)

        main_metric = next(
            (
                m
                for m in size_metrics
                if m.metrics_artifact_type
                == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
            ),
            size_metrics[0],
        )

        app_info = create_build_details_app_info(head_artifact)
        # Convert state integer to enum
        state_enum = PreprodArtifactSizeMetrics.SizeAnalysisState(main_metric.state)

        # Handle non-COMPLETED states
        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
            return Response(
                SizeAnalysisPendingResponse(
                    build_id=str(head_artifact.id),
                    app_info=app_info,
                ).dict()
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
            return Response(
                SizeAnalysisProcessingResponse(
                    build_id=str(head_artifact.id),
                    app_info=app_info,
                ).dict()
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
            return Response(
                SizeAnalysisFailedResponse(
                    build_id=str(head_artifact.id),
                    app_info=app_info,
                    error_code=main_metric.error_code,
                    error_message=main_metric.error_message,
                ).dict(),
                status=200,
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN:
            return Response(
                SizeAnalysisNotRanResponse(
                    build_id=str(head_artifact.id),
                    app_info=app_info,
                    error_code=main_metric.error_code,
                    error_message=main_metric.error_message,
                ).dict(),
                status=200,
            )

        # COMPLETED state - load analysis file
        analysis_file_id = main_metric.analysis_file_id
        if not analysis_file_id:
            logger.warning(
                "preprod.public_api.size_analysis.no_file_id",
                extra={"artifact_id": head_artifact.id, "size_metric_id": main_metric.id},
            )
            return Response(
                {"detail": "Size analysis completed but results are unavailable"}, status=500
            )

        try:
            file_obj = File.objects.get(id=analysis_file_id)
        except File.DoesNotExist:
            logger.warning(
                "preprod.public_api.size_analysis.file_not_found",
                extra={"artifact_id": head_artifact.id, "analysis_file_id": analysis_file_id},
            )
            return Response({"detail": "Analysis file not found"}, status=404)

        try:
            fp = file_obj.getfile()
            content = fp.read()
            analysis_data = json.loads(content)
            analysis_results = SizeAnalysisResults(**analysis_data)
        except Exception:
            logger.exception(
                "preprod.public_api.size_analysis.parse_error",
                extra={"artifact_id": head_artifact.id, "analysis_file_id": analysis_file_id},
            )
            return Response({"detail": "Failed to parse size analysis results"}, status=500)

        # Build base response for COMPLETED state
        response_data = SizeAnalysisCompletedResponse(
            build_id=str(head_artifact.id),
            app_info=app_info,
            download_size=analysis_results.download_size,
            install_size=analysis_results.install_size,
            analysis_duration=analysis_results.analysis_duration,
            analysis_version=analysis_results.analysis_version,
            insights=analysis_results.insights,
            app_components=analysis_results.app_components,
        )

        # Add comparison data if base artifact exists
        base_artifact = self._get_base_artifact(request, project, head_artifact)
        if base_artifact:
            comparison_data = self._build_comparison_data(
                project, head_artifact, base_artifact, size_metrics
            )
            if comparison_data:
                response_data.base_build_id = str(base_artifact.id)
                response_data.base_app_info = create_build_details_app_info(base_artifact)
                response_data.comparisons = comparison_data

        return Response(response_data.dict())

    def _get_base_artifact(
        self,
        request: Request,
        project: Project,
        head_artifact: PreprodArtifact,
    ) -> PreprodArtifact | None:
        """Get the base artifact for comparison."""
        base_id = request.GET.get("base_id")

        if base_id:
            try:
                base_artifact = PreprodArtifact.objects.select_related(
                    "mobile_app_info", "build_configuration"
                ).get(id=int(base_id), project=project)
                return base_artifact
            except (PreprodArtifact.DoesNotExist, ValueError):
                raise PreprodArtifactResourceDoesNotExist(
                    detail="The requested base preprod artifact does not exist"
                )

        # Use default base from commit_comparison
        base_artifact_qs = head_artifact.get_base_artifact_for_commit().select_related(
            "mobile_app_info", "build_configuration"
        )
        return base_artifact_qs.first()

    def _build_comparison_data(
        self,
        project: Project,
        head_artifact: PreprodArtifact,
        base_artifact: PreprodArtifact,
        head_size_metrics: list[PreprodArtifactSizeMetrics],
    ) -> list[PublicComparisonResult] | None:
        """Build comparison results for head vs base artifact."""
        base_size_metrics = list(
            PreprodArtifactSizeMetrics.objects.filter(
                preprod_artifact=base_artifact,
                preprod_artifact__project=project,
            ).select_related("preprod_artifact")
        )

        if not base_size_metrics:
            return None

        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        comparisons: list[PublicComparisonResult] = []
        for key, head_metric in head_metrics_map.items():
            base_metric = base_metrics_map.get(key)

            if not base_metric:
                comparisons.append(
                    PublicComparisonResult(
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        error_code="NO_BASE_METRIC",
                        error_message="No matching base artifact size metric found.",
                    )
                )
                continue

            try:
                comparison_obj = PreprodArtifactSizeComparison.objects.get(
                    head_size_analysis_id=head_metric.id,
                    base_size_analysis_id=base_metric.id,
                )
            except PreprodArtifactSizeComparison.DoesNotExist:
                continue

            comparison_result = self._build_comparison_result(head_metric, comparison_obj)
            comparisons.append(comparison_result)

        return comparisons if comparisons else None

    def _build_comparison_result(
        self,
        head_metric: PreprodArtifactSizeMetrics,
        comparison_obj: PreprodArtifactSizeComparison,
    ) -> PublicComparisonResult:
        """Build a single comparison result."""
        if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
            return self._build_success_comparison(head_metric, comparison_obj)
        elif comparison_obj.state == PreprodArtifactSizeComparison.State.FAILED:
            return PublicComparisonResult(
                metrics_artifact_type=head_metric.metrics_artifact_type,
                identifier=head_metric.identifier,
                state=PreprodArtifactSizeComparison.State.FAILED,
                error_code=(
                    str(comparison_obj.error_code)
                    if comparison_obj.error_code is not None
                    else None
                ),
                error_message=comparison_obj.error_message,
            )
        else:
            return PublicComparisonResult(
                metrics_artifact_type=head_metric.metrics_artifact_type,
                identifier=head_metric.identifier,
                state=PreprodArtifactSizeComparison.State.PROCESSING,
            )

    def _build_success_comparison(
        self,
        head_metric: PreprodArtifactSizeMetrics,
        comparison_obj: PreprodArtifactSizeComparison,
    ) -> PublicComparisonResult:
        """Build a comparison result with inlined diff data for SUCCESS state."""
        comparison_result = PublicComparisonResult(
            metrics_artifact_type=head_metric.metrics_artifact_type,
            identifier=head_metric.identifier,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        if comparison_obj.file_id is None:
            logger.warning(
                "preprod.public_api.compare.success_no_file",
                extra={"comparison_id": comparison_obj.id},
            )
            return comparison_result

        try:
            file_obj = File.objects.get(id=comparison_obj.file_id)
            fp = file_obj.getfile()
            content = fp.read()
            comparison_data = json.loads(content)
            comparison_results = ComparisonResults(**comparison_data)

            comparison_result.diff_items = comparison_results.diff_items
            comparison_result.insight_diff_items = comparison_results.insight_diff_items
            comparison_result.size_metric_diff = comparison_results.size_metric_diff_item

        except File.DoesNotExist:
            logger.warning(
                "preprod.public_api.compare.file_not_found",
                extra={"comparison_id": comparison_obj.id, "file_id": comparison_obj.file_id},
            )
        except Exception:
            logger.exception(
                "preprod.public_api.compare.parse_error",
                extra={"comparison_id": comparison_obj.id, "file_id": comparison_obj.file_id},
            )

        return comparison_result
