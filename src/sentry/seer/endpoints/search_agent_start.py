from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.db import router, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import collect_user_org_context
from sentry.seer.endpoints.trace_explorer_ai_setup import OrganizationTraceExplorerAIPermission
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import (
    SearchAgentStartRequest,
    SeerViewerContext,
    make_search_agent_start_request,
)

logger = logging.getLogger(__name__)


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

    def validate_options(self, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if value is None:
            return None
        if "model_name" in value and not isinstance(value["model_name"], str):
            raise serializers.ValidationError("model_name must be a string")
        return value


def _build_search_agent_body(
    org_id: int,
    org_slug: str,
    project_ids: list[int],
    natural_language_query: str,
    strategy: str = "Traces",
    user_email: str | None = None,
    user_timezone: str | None = None,
    model_name: str | None = None,
    metric_context: dict[str, Any] | None = None,
) -> SearchAgentStartRequest:
    body = SearchAgentStartRequest(
        org_id=org_id,
        org_slug=org_slug,
        project_ids=project_ids,
        natural_language_query=natural_language_query,
        strategy=strategy,
    )
    if user_email:
        body["user_email"] = user_email
    if user_timezone:
        body["timezone"] = user_timezone

    options: dict[str, Any] = {}
    if model_name is not None:
        options["model_name"] = model_name
    if metric_context is not None:
        options["metric_context"] = metric_context
    if options:
        body["options"] = options
    return body


def send_search_agent_start_request(
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
) -> dict[str, Any]:
    """
    Sends a request to Seer to start an async search agent and returns a run_id for polling.
    """
    body = _build_search_agent_body(
        org_id=org_id,
        org_slug=org_slug,
        project_ids=project_ids,
        natural_language_query=natural_language_query,
        strategy=strategy,
        user_email=user_email,
        user_timezone=timezone,
        model_name=model_name,
        metric_context=metric_context,
    )
    response = make_search_agent_start_request(body, timeout=30, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    return response.json()


def start_search_agent_via_outbox(
    organization: Organization,
    user_id: int | None,
    body: SearchAgentStartRequest,
    viewer_context: SeerViewerContext,
) -> int:
    """
    Mirror an assisted-query run into SeerRun and dispatch its start request via
    the cell outbox. The receiver fires on commit (flush=True), makes the HTTPS
    call to Seer with run.uuid as external_idempotency_key, and fills in
    seer_run_state_id. Raises SeerApiError if the run did not reach LIVE.
    """
    with outbox_context(transaction.atomic(using=router.db_for_write(SeerRun)), flush=True):
        run = SeerRun.objects.create(
            organization=organization,
            user_id=user_id,
            type=SeerRunType.ASSISTED_QUERY,
            last_triggered_at=timezone.now(),
        )
        CellOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=organization.id,
            category=OutboxCategory.SEER_RUN_CREATE,
            object_identifier=run.id,
            payload={"body": dict(body), "viewer_context": dict(viewer_context)},
        ).save()

    run.refresh_from_db()
    if run.mirror_status != SeerRunMirrorStatus.LIVE or run.seer_run_state_id is None:
        raise SeerApiError("Seer run mirror failed to materialize", 500)
    return run.seer_run_state_id


@cell_silo_endpoint
class SearchAgentStartEndpoint(OrganizationEndpoint):
    """
    Endpoint to start an async search agent and return a run_id for polling.

    This starts the agent processing in the background and immediately returns
    a run_id that can be used with the /search-agent/state/ endpoint to poll
    for progress and results.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Start an async search agent and return a run_id for polling.

        Returns:
            {"run_id": int}
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

        projects = self.get_projects(
            request, organization, project_ids=set(validated_data["project_ids"])
        )
        project_ids = [project.id for project in projects]

        has_feature = features.has(
            "organizations:gen-ai-search-agent-translate", organization, actor=request.user
        )
        if strategy == "Metrics":
            has_feature = has_feature and features.has(
                "organizations:gen-ai-explore-metrics-search",
                organization,
                actor=request.user,
            )
        if not has_feature:
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

        # Collect user context for the agent
        user_org_context = collect_user_org_context(request.user, organization)
        user_email = user_org_context.get("user_email")
        timezone = user_org_context.get("user_timezone")

        try:
            viewer_context = SeerViewerContext(
                organization_id=organization.id, user_id=request.user.id
            )

            if features.has("organizations:seer-run-mirror", organization, actor=request.user):
                body = _build_search_agent_body(
                    org_id=organization.id,
                    org_slug=organization.slug,
                    project_ids=project_ids,
                    natural_language_query=natural_language_query,
                    strategy=strategy,
                    user_email=user_email,
                    user_timezone=timezone,
                    model_name=model_name,
                    metric_context=metric_context,
                )
                run_id = start_search_agent_via_outbox(
                    organization=organization,
                    user_id=request.user.id,
                    body=body,
                    viewer_context=viewer_context,
                )
                return Response({"run_id": run_id})

            data = send_search_agent_start_request(
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
            )

            # Validate that run_id is present in the response
            response_run_id = data.get("run_id")
            if response_run_id is None:
                logger.error(
                    "search_agent.missing_run_id",
                    extra={
                        "organization_id": organization.id,
                        "project_ids": project_ids,
                        "response_data": data,
                    },
                )
                return Response(
                    {"detail": "Failed to start search agent: missing run_id in response"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Return the run_id for polling
            return Response({"run_id": response_run_id})

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
