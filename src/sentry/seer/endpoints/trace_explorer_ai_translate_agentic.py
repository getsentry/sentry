from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.search_agent_examples import SearchAgentExamples
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import collect_user_org_context
from sentry.seer.endpoints.search_agent_types import (
    SEARCH_AGENT_STRATEGIES,
    SearchAgentTranslateResponse,
)
from sentry.seer.endpoints.trace_explorer_ai_setup import OrganizationTraceExplorerAIPermission
from sentry.seer.models import SeerApiError
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import (
    SeerViewerContext,
    TranslateAgenticRequest,
    make_translate_agentic_request,
)

logger = logging.getLogger(__name__)


@sentry_schema_serializer(
    omit_from_public_schema={
        "options": "Internal model and UI tuning knobs used by the Sentry frontend.",
    }
)
class SearchAgentTranslateSerializer(serializers.Serializer):
    project_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False,
        help_text="The IDs of the projects to search in.",
    )
    natural_language_query = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="The natural language query to translate, e.g. `slowest http requests in the last day`.",
    )
    strategy = serializers.ChoiceField(
        choices=SEARCH_AGENT_STRATEGIES,
        required=False,
        default="Traces",
        help_text="The dataset to generate a query for.",
    )
    options = serializers.DictField(
        required=False,
        allow_null=True,
        help_text="Optional configuration options.",
    )

    def validate_options(self, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        if "model_name" in value and not isinstance(value["model_name"], str):
            raise serializers.ValidationError("model_name must be a string")
        return value


def send_translate_agentic_request(
    org_id: int,
    org_slug: str,
    project_ids: list[int],
    natural_language_query: str,
    strategy: str = "Traces",
    user_email: str | None = None,
    timezone: str | None = None,
    model_name: str | None = None,
    metric_context: dict[str, Any] | None = None,
    viewer_context: SeerViewerContext | None = None,
    options: dict[str, Any] | None = None,
) -> SearchAgentTranslateResponse:
    """
    Sends a request to seer to translate a natural language query using the agentic search API.
    """
    body = TranslateAgenticRequest(
        org_id=org_id,
        org_slug=org_slug,
        project_ids=project_ids,
        natural_language_query=natural_language_query,
        strategy=strategy,
    )
    if user_email:
        body["user_email"] = user_email
    if timezone:
        body["timezone"] = timezone

    merged_options: dict[str, Any] = {**(options or {})}
    if model_name is not None:
        merged_options["model_name"] = model_name
    if metric_context is not None:
        merged_options["metric_context"] = metric_context
    body["options"] = merged_options

    response = make_translate_agentic_request(body, timeout=10, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    return response.json()


@cell_silo_endpoint
@extend_schema(tags=["Seer Agent"])
class SearchAgentTranslateEndpoint(OrganizationEndpoint):
    """
    Endpoint to call Seer's agentic search API for translating natural language queries.
    """

    publish_status = {
        "POST": ApiPublishStatus.PUBLIC_EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    @extend_schema(
        operation_id="translateSearchAgentQuery",
        summary="Translate a Natural Language Query",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=SearchAgentTranslateSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "SearchAgentTranslateResponse", SearchAgentTranslateResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SearchAgentExamples.TRANSLATE_RESPONSE,
    )
    def post(
        self, request: Request, organization: Organization
    ) -> (
        Response[SearchAgentTranslateResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
    ):
        """
        Translate a natural language query into Sentry search queries for the given dataset,
        waiting for Seer's search agent to finish. For long-running queries, prefer
        [Start a Search Agent Run](/api/seer-agent/start-a-search-agent-run/) and poll for the result.

        Each entry in `responses` is a query to run against the dataset, with its
        `group_by`, `visualization` (aggregates to chart), `sort`, and time range
        (`stats_period`, or `start` and `end`). If the query can't be translated,
        `responses` is empty and `unsupported_reason` explains why. Requires Seer to be
        enabled for the organization.
        """
        serializer = SearchAgentTranslateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        natural_language_query = validated_data["natural_language_query"]
        strategy = validated_data.get("strategy", "Traces")
        options = validated_data.get("options") or {}
        model_name = options.get("model_name")
        metric_context = options.get("metric_context")
        code_mode_toggle = bool(options.get("code_mode"))

        projects = self.get_projects(
            request, organization, project_ids=set(validated_data["project_ids"])
        )
        project_ids = [project.id for project in projects]

        if not features.has("organizations:seer-explorer", organization, actor=request.user):
            return Response(
                {"detail": "Feature flag not enabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        has_seer_access, detail = has_seer_access_with_detail(organization, actor=request.user)
        if not has_seer_access:
            return Response(
                {"detail": detail},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not settings.SEER_AUTOFIX_URL:
            return Response(
                {"detail": "Seer is not properly configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        user_org_context = collect_user_org_context(request.user, organization)
        user_email = user_org_context.get("user_email")
        timezone = user_org_context.get("user_timezone")

        viewer_context = SeerViewerContext(organization_id=organization.id, user_id=request.user.id)
        options["cross_event"] = features.has(
            "organizations:seer-assisted-query-cross-event-explorer",
            organization,
            actor=request.user,
        )
        options["project_expansion"] = features.has(
            "organizations:seer-assisted-query-project-expansion",
            organization,
            actor=request.user,
        )
        options["reflection_step"] = features.has(
            "organizations:seer-assisted-query-reflection",
            organization,
            actor=request.user,
        )
        options["code_mode"] = code_mode_toggle and features.has(
            "organizations:seer-assisted-query-codemode",
            organization,
            actor=request.user,
        )
        data = send_translate_agentic_request(
            organization.id,
            organization.slug,
            project_ids,
            natural_language_query,
            strategy=strategy,
            user_email=user_email,
            timezone=timezone,
            model_name=model_name,
            metric_context=metric_context,
            viewer_context=viewer_context,
            options=options,
        )
        return Response(data)
