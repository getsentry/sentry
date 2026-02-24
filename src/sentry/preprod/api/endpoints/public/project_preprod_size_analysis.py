from __future__ import annotations

import logging
from typing import assert_never, cast

import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactResourceDoesNotExist,
)
from sentry.preprod.api.models.public_api_models import (
    AppComponentResponseDict,
    AppInfoResponseDict,
    GitInfoResponseDict,
    SizeAnalysisCompletedResponseDict,
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
class OrganizationPreprodPublicSizeAnalysisEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve Size Analysis results for a given artifact",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="artifact_id",
                description="The ID of the build artifact.",
                required=True,
                type=str,
                location="path",
            ),
            OpenApiParameter(
                name="base_artifact_id",
                description="Optional ID of the base artifact to compare against. If not provided, uses the default base head artifact.",
                required=False,
                type=str,
                location="query",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SizeAnalysisResponse", SizeAnalysisCompletedResponseDict
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        artifact_id: str,
    ) -> Response:
        """
        Retrieve size analysis results for a build artifact.

        Returns size metrics including download size, install size, and optional insights.
        When a base artifact exists (either from commit comparison or via the base_artifact_id parameter),
        comparison data showing size differences is included.
        """

        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            head_artifact = PreprodArtifact.objects.select_related(
                "mobile_app_info", "build_configuration", "commit_comparison"
            ).get(id=int(artifact_id), project__organization_id=organization.id)
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "The requested preprod artifact does not exist"}, status=404)

        app_info = create_app_info_dict(head_artifact)
        git_info = create_git_info_dict(head_artifact)

        size_metrics = list(head_artifact.get_size_metrics())

        if not size_metrics:
            return Response(
                {
                    "state": "PENDING",
                    "build_id": str(head_artifact.id),
                    "app_info": app_info,
                    "git_info": git_info,
                }
            )

        main_metric = next(
            (
                m
                for m in size_metrics
                if m.metrics_artifact_type
                == PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT
            ),
            size_metrics[0],
        )
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

        match state_enum:
            case PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
                return Response(
                    {
                        "state": "PENDING",
                        "build_id": str(head_artifact.id),
                        "app_info": app_info,
                        "git_info": git_info,
                    }
                )
            case PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
                return Response(
                    {
                        "state": "PROCESSING",
                        "build_id": str(head_artifact.id),
                        "app_info": app_info,
                        "git_info": git_info,
                    }
                )
            case (
                PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
                | PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN
            ):
                return Response(
                    {
                        "state": state_enum.name,
                        "build_id": str(head_artifact.id),
                        "app_info": app_info,
                        "git_info": git_info,
                        "error_code": main_metric.error_code,
                        "error_message": main_metric.error_message,
                    },
                    status=200,
                )
            case PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
                return self._build_completed_response(
                    request,
                    organization,
                    head_artifact,
                    main_metric,
                    app_info,
                    git_info,
                    size_metrics,
                )
            case _:
                assert_never(state_enum)

    def _build_completed_response(
        self,
        request: Request,
        organization: Organization,
        head_artifact: PreprodArtifact,
        main_metric: PreprodArtifactSizeMetrics,
        app_info: AppInfoResponseDict,
        git_info: GitInfoResponseDict | None,
        size_metrics: list[PreprodArtifactSizeMetrics],
    ) -> Response:
        """Build response for a completed size analysis."""
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
            with file_obj.getfile() as fp:
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

        response_data: SizeAnalysisCompletedResponseDict = {
            "build_id": str(head_artifact.id),
            "state": "COMPLETED",
            "app_info": app_info,
            "git_info": git_info,
            "download_size": analysis_results.download_size,
            "install_size": analysis_results.install_size,
            "analysis_duration": analysis_results.analysis_duration,
            "analysis_version": analysis_results.analysis_version,
            "insights": analysis_results.insights.dict() if analysis_results.insights else None,
            "app_components": cast(
                list[AppComponentResponseDict],
                [c.dict(exclude={"model_config"}) for c in analysis_results.app_components],
            )
            if analysis_results.app_components
            else None,
        }

        base_artifact = self._get_base_artifact(request, organization, head_artifact)
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
        organization: Organization,
        head_artifact: PreprodArtifact,
    ) -> PreprodArtifact | None:
        base_artifact_id = request.GET.get("base_artifact_id")

        if base_artifact_id:
            try:
                base_artifact = PreprodArtifact.objects.select_related(
                    "mobile_app_info", "build_configuration", "commit_comparison"
                ).get(id=int(base_artifact_id), project__organization_id=organization.id)
                return base_artifact
            except (PreprodArtifact.DoesNotExist, ValueError):
                raise PreprodArtifactResourceDoesNotExist(
                    detail="The requested base preprod artifact does not exist"
                )

        base_artifact_qs = head_artifact.get_base_artifact_for_commit().select_related(
            "mobile_app_info", "build_configuration", "commit_comparison"
        )
        return base_artifact_qs.first()
