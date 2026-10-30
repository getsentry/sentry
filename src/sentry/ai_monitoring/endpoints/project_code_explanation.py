from typing import TypedDict

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.ai_monitoring.code_explanations import MAX_CODE_LENGTH, get_code_explanation
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_TOO_MANY_REQUESTS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class CodeExplanationRequestSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=MAX_CODE_LENGTH, trim_whitespace=False)
    language = serializers.CharField(max_length=64, required=False, default="javascript")

    def validate_code(self, value: str) -> str:
        if not value.strip():
            raise ValidationError("Code must not be empty.")
        return value


class CodeExplanationResponse(TypedDict):
    summary: str


class CodeExplanationPermission(ProjectPermission):
    scope_map = {"POST": ["project:read", "project:write", "project:admin"]}


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class ProjectCodeExplanationEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    permission_classes = (CodeExplanationPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=30, window=60),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="explainProjectAICode",
        summary="Explain Code Executed by an AI Tool",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=CodeExplanationRequestSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "CodeExplanationResponse", CodeExplanationResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            429: RESPONSE_TOO_MANY_REQUESTS,
            502: OpenApiResponse(description="Seer could not generate an explanation."),
        },
    )
    def post(
        self, request: Request, project: Project
    ) -> Response[CodeExplanationResponse] | Response[DetailResponse]:
        """Return a short explanation of captured code without executing it.

        Successful explanations are cached per project, code, and language for one day.
        Generation waits for a single Seer response, with a ten-second timeout.
        """
        organization = project.organization
        has_access, error = has_seer_access_with_detail(organization)
        if not has_access:
            return Response({"detail": error or "AI features are unavailable."}, status=403)

        serializer = CodeExplanationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Provide non-empty code and a valid language."}, status=400)

        summary = get_code_explanation(
            project, serializer.validated_data["code"], serializer.validated_data["language"]
        )
        if summary is None:
            return Response({"detail": "Unable to generate a code explanation."}, status=502)
        return Response({"summary": summary})
