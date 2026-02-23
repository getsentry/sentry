from __future__ import annotations

import logging

import sentry_sdk
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
from sentry.preprod.api.models.public_api_models import (
    SizeAnalysisCompletedResponseDict,
    SizeAnalysisResponseDict,
    build_comparison_data,
    create_app_info_dict,
    create_git_info_dict,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import SizeAnalysisResults
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

        app_info = create_app_info_dict(head_artifact)
        git_info = create_git_info_dict(head_artifact)
        try:
            state_enum = PreprodArtifactSizeMetrics.SizeAnalysisState(main_metric.state)
        except ValueError:
            sentry_sdk.capture_message(
                "preprod.public_api.size_analysis.invalid_state",
                level="warning",
                extras={"artifact_id": head_artifact.id, "state": main_metric.state},
            )
            return Response(
                {"detail": "There was an error retrieving size analysis results"}, status=500
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
            return Response(
                {
                    "state": "PENDING",
                    "build_id": str(head_artifact.id),
                    "app_info": app_info,
                    "git_info": git_info,
                }
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
            return Response(
                {
                    "state": "PROCESSING",
                    "build_id": str(head_artifact.id),
                    "app_info": app_info,
                    "git_info": git_info,
                }
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
            return Response(
                {
                    "state": "FAILED",
                    "build_id": str(head_artifact.id),
                    "app_info": app_info,
                    "git_info": git_info,
                    "error_code": main_metric.error_code,
                    "error_message": main_metric.error_message,
                },
                status=200,
            )

        if state_enum == PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN:
            return Response(
                {
                    "state": "NOT_RAN",
                    "build_id": str(head_artifact.id),
                    "app_info": app_info,
                    "git_info": git_info,
                    "error_code": main_metric.error_code,
                    "error_message": main_metric.error_message,
                },
                status=200,
            )

        analysis_file_id = main_metric.analysis_file_id
        if not analysis_file_id:
            sentry_sdk.capture_message(
                "preprod.public_api.size_analysis.no_file_id",
                level="warning",
                extras={"artifact_id": head_artifact.id, "size_metric_id": main_metric.id},
            )
            return Response(
                {"detail": "There was an error retrieving size analysis results"}, status=500
            )

        try:
            file_obj = File.objects.get(id=analysis_file_id)
        except File.DoesNotExist:
            sentry_sdk.capture_message(
                "preprod.public_api.size_analysis.file_not_found",
                level="warning",
                extras={"artifact_id": head_artifact.id, "analysis_file_id": analysis_file_id},
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
            return Response(
                {"detail": "There was an error retrieving size analysis results"}, status=500
            )

        analysis_dict = analysis_results.dict()
        response_data: SizeAnalysisCompletedResponseDict = {
            "build_id": str(head_artifact.id),
            "state": "COMPLETED",
            "app_info": app_info,
            "git_info": git_info,
            "download_size": analysis_dict["download_size"],
            "install_size": analysis_dict["install_size"],
            "analysis_duration": analysis_dict["analysis_duration"],
            "analysis_version": analysis_dict["analysis_version"],
            "insights": analysis_dict["insights"],
            "app_components": analysis_dict["app_components"],
        }

        base_artifact = self._get_base_artifact(request, project, head_artifact)
        if base_artifact:
            comparisons = build_comparison_data(base_artifact, size_metrics)
            if comparisons:
                response_data["base_build_id"] = str(base_artifact.id)
                response_data["base_app_info"] = create_app_info_dict(base_artifact)
                response_data["comparisons"] = comparisons

        return Response(response_data)

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
