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
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactResourceDoesNotExist,
)
from sentry.preprod.api.models.public.shared import create_app_info_dict, create_git_info_dict
from sentry.preprod.api.models.public.size_analysis import (
    AppComponentResponseDict,
    SizeAnalysisResponseDict,
    build_comparison_data,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.models import SizeAnalysisResults
from sentry.utils import json

logger = logging.getLogger(__name__)


def _base_response(
    head_artifact: PreprodArtifact,
) -> SizeAnalysisResponseDict:
    return {
        "buildId": str(head_artifact.id),
        "state": "PENDING",
        "appInfo": create_app_info_dict(head_artifact),
        "gitInfo": create_git_info_dict(head_artifact),
        "errorCode": None,
        "errorMessage": None,
        "downloadSize": None,
        "installSize": None,
        "analysisDuration": None,
        "analysisVersion": None,
        "insights": None,
        "appComponents": None,
        "baseBuildId": None,
        "baseAppInfo": None,
        "comparisons": None,
    }


@extend_schema(tags=["Mobile Builds"])
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
                name="baseArtifactId",
                description="Optional ID of the base artifact to compare against. If not provided, uses the default base head artifact.",
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
        examples=PreprodExamples.GET_SIZE_ANALYSIS,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        artifact_id: str,
    ) -> Response:
        """
        Retrieve size analysis results for a given artifact.

        Returns size metrics including download size, install size, and optional insights.
        When a base artifact exists (either from commit comparison or via the `baseArtifactId` parameter),
        comparison data showing size differences is included.

        The response `state` field indicates the analysis status:
        - `PENDING`: Analysis has not started yet.
        - `PROCESSING`: Analysis is currently running.
        - `FAILED` / `NOT_RAN`: Analysis did not complete; `errorCode` and `errorMessage` are included.
        - `COMPLETED`: Analysis finished successfully with full size data.
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

        response_data = _base_response(head_artifact)

        size_metrics = list(head_artifact.get_size_metrics())

        if not size_metrics:
            return Response(response_data)

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
                extra={"artifact_id": head_artifact.id, "state": main_metric.state},
            )
            return Response(
                {"detail": "There was an error retrieving size analysis results"}, status=500
            )

        response_data["state"] = state_enum.name

        match state_enum:
            case (
                PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING
                | PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING
            ):
                return Response(response_data)
            case (
                PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
                | PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN
            ):
                response_data["errorCode"] = (
                    PreprodArtifactSizeMetrics.ErrorCode(main_metric.error_code).name
                    if main_metric.error_code is not None
                    else None
                )
                response_data["errorMessage"] = main_metric.error_message
                return Response(response_data)
            case PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED:
                return self._build_completed_response(
                    request,
                    organization,
                    head_artifact,
                    main_metric,
                    response_data,
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
        response_data: SizeAnalysisResponseDict,
        size_metrics: list[PreprodArtifactSizeMetrics],
    ) -> Response:
        """Build response for a completed size analysis."""
        analysis_file_id = main_metric.analysis_file_id
        if not analysis_file_id:
            sentry_sdk.capture_message(
                "preprod.public_api.size_analysis.no_file_id",
                level="warning",
                extra={"artifact_id": head_artifact.id, "size_metric_id": main_metric.id},
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
                extra={"artifact_id": head_artifact.id, "analysis_file_id": analysis_file_id},
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

        response_data["downloadSize"] = analysis_results.download_size
        response_data["installSize"] = analysis_results.install_size
        response_data["analysisDuration"] = analysis_results.analysis_duration
        response_data["analysisVersion"] = analysis_results.analysis_version
        response_data["insights"] = (
            convert_dict_key_case(analysis_results.insights.dict(), snake_to_camel_case)
            if analysis_results.insights
            else None
        )
        response_data["appComponents"] = (
            cast(
                list[AppComponentResponseDict],
                [
                    convert_dict_key_case(c.dict(exclude={"model_config"}), snake_to_camel_case)
                    | {
                        "componentType": PreprodArtifactSizeMetrics.MetricsArtifactType(
                            c.component_type
                        ).name
                    }
                    for c in analysis_results.app_components
                ],
            )
            if analysis_results.app_components
            else None
        )

        base_artifact = self._get_base_artifact(request, organization, head_artifact)
        if base_artifact:
            comparisons = build_comparison_data(base_artifact, size_metrics)
            if comparisons:
                response_data["baseBuildId"] = str(base_artifact.id)
                response_data["baseAppInfo"] = create_app_info_dict(base_artifact)
                response_data["comparisons"] = comparisons

        return Response(response_data)

    def _get_base_artifact(
        self,
        request: Request,
        organization: Organization,
        head_artifact: PreprodArtifact,
    ) -> PreprodArtifact | None:
        base_artifact_id = request.GET.get("baseArtifactId")

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
