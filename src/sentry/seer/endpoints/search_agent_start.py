from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

import sentry_sdk
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.client_kind import ClientKind, get_client_kind
from sentry.middleware import is_frontend_request
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import collect_user_org_context, enqueue_seer_run
from sentry.seer.endpoints.utils import OrganizationTraceExplorerAIPermission
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunType
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import SearchAgentStartRequest, SeerViewerContext

logger = logging.getLogger(__name__)


class SearchAgentResultTarget(StrEnum):
    """Where the caller will use the translated query."""

    UI_SEARCH = "ui_search"
    AGENT_SEARCH = "agent_search"


class SearchAgentReferrer(StrEnum):
    """Allowlist of callers that may start a search agent run.

    Forwarded to Seer, which combines it with the strategy to pick the RPC referrer
    (e.g. `assisted_query.mcp.traces`). Add a value here before a client sends it.
    """

    SEARCH_BAR = "search_bar"
    MCP = "mcp"


def resolve_referrer(request: Request, raw: str | None) -> SearchAgentReferrer | None:
    """Pick the referrer to forward to Seer.

    The Sentry MCP server is derived from the request (its user agent) and wins over
    whatever the client declared. Otherwise a declared referrer is used if it is on the
    allowlist; unknown values are dropped rather than rejected, so an outdated client
    keeps working and Seer falls back to its default referrer.
    """
    if get_client_kind(request) == ClientKind.MCP:
        return SearchAgentReferrer.MCP
    if not raw:
        return None
    try:
        return SearchAgentReferrer(raw)
    except ValueError:
        logger.warning("search_agent.unknown_referrer", extra={"referrer": raw})
        return None


def infer_result_target(request: Request) -> SearchAgentResultTarget:
    """Classify web UI requests as ``ui_search`` and all other callers as ``agent_search``."""
    if is_frontend_request(request):
        return SearchAgentResultTarget.UI_SEARCH
    return SearchAgentResultTarget.AGENT_SEARCH


class SearchAgentStartSerializer(serializers.Serializer):
    project_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False,
        help_text="List of project IDs to search in.",
    )
    natural_language_query = serializers.CharField(
        required=True,
        allow_blank=False,
        help_text="Natural language query to translate.",
    )
    strategy = serializers.CharField(
        required=False,
        default="Traces",
        help_text="Search strategy to use (Traces, Issues, Logs, Errors, Metrics).",
    )
    options = serializers.DictField(
        required=False,
        allow_null=True,
        help_text="Optional configuration options.",
    )
    referrer = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Which caller started the run (e.g. `search_bar`). Unknown values are ignored.",
    )

    def validate_options(self, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        if "model_name" in value and not isinstance(value["model_name"], str):
            raise serializers.ValidationError("model_name must be a string")
        return value


def send_search_agent_start_request(
    organization: Organization,
    user_id: int | None,
    project_ids: list[int],
    natural_language_query: str,
    strategy: str = "Traces",
    user_email: str | None = None,
    timezone: str | None = None,
    model_name: str | None = None,
    metric_context: dict[str, Any] | None = None,
    viewer_context: SeerViewerContext | None = None,
    cross_event: bool = False,
    reflection_step: bool = False,
    code_mode: bool = False,
    result_target: SearchAgentResultTarget | None = None,
    referrer: SearchAgentReferrer | None = None,
) -> SeerRun:
    """Create the SeerRun mirror and enqueue the outbox that starts the agent in Seer."""
    body = SearchAgentStartRequest(
        org_id=organization.id,
        org_slug=organization.slug,
        project_ids=project_ids,
        natural_language_query=natural_language_query,
        strategy=strategy,
    )
    if user_email:
        body["user_email"] = user_email
    if timezone:
        body["timezone"] = timezone

    options: dict[str, Any] = {
        "cross_event": cross_event,
        "reflection_step": reflection_step,
        "code_mode": code_mode,
    }
    if model_name is not None:
        options["model_name"] = model_name
    if metric_context is not None:
        options["metric_context"] = metric_context
    if result_target is not None:
        options["result_target"] = result_target.value
    if referrer is not None:
        # Seer combines this with the strategy to pick the RPC referrer.
        options["source"] = referrer.value
    body["options"] = options

    return enqueue_seer_run(
        organization=organization,
        run_type=SeerRunType.ASSISTED_QUERY,
        body=body,
        viewer_context=viewer_context,
        user_id=user_id,
    )


@cell_silo_endpoint
class SearchAgentStartEndpoint(OrganizationEndpoint):
    """
    Endpoint to start an async search agent and return a run_id for polling.

    This starts the agent processing in the background and immediately returns
    a run_id that can be used with the /search-agent/state/ endpoint to poll
    for progress and results.
    """

    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Start an async search agent and return a run_id for polling.

        Returns:
            {"run_id": int, "sentry_run_id": str}
        """
        serializer = SearchAgentStartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        natural_language_query = validated_data["natural_language_query"]
        strategy = validated_data.get("strategy", "Traces")
        options = validated_data.get("options") or {}
        model_name = options.get("model_name")
        metric_context = options.get("metric_context")
        result_target = infer_result_target(request)
        sentry_sdk.set_tag("search_agent.result_target", result_target.value)
        referrer = resolve_referrer(request, validated_data.get("referrer"))
        sentry_sdk.set_tag("search_agent.referrer", referrer.value if referrer else None)

        projects = self.get_projects(
            request, organization, project_ids=set(validated_data["project_ids"])
        )
        project_ids = [project.id for project in projects]

        if strategy == "Issues" and not features.has(
            "organizations:gen-ai-issues-search",
            organization,
            actor=request.user,
        ):
            return Response(
                {"detail": "Feature flag not enabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        has_seer_access, detail = has_seer_access_with_detail(organization)
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

        # Collect user context for the agent
        user_org_context = collect_user_org_context(request.user, organization)
        user_email = user_org_context.get("user_email")
        timezone = user_org_context.get("user_timezone")
        try:
            viewer_context = SeerViewerContext(
                organization_id=organization.id, user_id=request.user.id
            )
            result = send_search_agent_start_request(
                organization=organization,
                user_id=request.user.id,
                project_ids=project_ids,
                natural_language_query=natural_language_query,
                strategy=strategy,
                user_email=user_email,
                timezone=timezone,
                model_name=model_name,
                metric_context=metric_context,
                viewer_context=viewer_context,
                cross_event=features.has(
                    "organizations:seer-assisted-query-cross-event-explorer",
                    organization,
                    actor=request.user,
                ),
                reflection_step=features.has(
                    "organizations:seer-assisted-query-reflection",
                    organization,
                    actor=request.user,
                ),
                code_mode=features.has(
                    "organizations:seer-assisted-query-codemode",
                    organization,
                    actor=request.user,
                ),
                result_target=result_target,
                referrer=referrer,
            )
            return Response(
                {
                    "run_id": result.seer_run_state_id,
                    "sentry_run_id": str(result.uuid),
                }
            )

        except SeerApiError as e:
            logger.exception(
                "search_agent.start_error",
                extra={
                    "organization_id": organization.id,
                    "project_ids": project_ids,
                    "status_code": e.status,
                },
            )
            return Response(
                {"detail": "Failed to start search agent"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except Exception:
            logger.exception(
                "search_agent.start_error",
                extra={
                    "organization_id": organization.id,
                    "project_ids": project_ids,
                },
            )
            return Response(
                {"detail": "Failed to start search agent"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
