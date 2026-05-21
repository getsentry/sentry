from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.db import router, transaction
from django.utils.timezone import now
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.hybridcloud.models.outbox import (
    CellOutbox,
    OutboxDatabaseError,
    OutboxFlushError,
    outbox_context,
)
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
from sentry.utils import metrics

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
) -> SeerRun | int:
    """Start an async search agent and return a run_id for polling."""
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

    options: dict[str, Any] = {}
    if model_name is not None:
        options["model_name"] = model_name
    if metric_context is not None:
        options["metric_context"] = metric_context
    if options:
        body["options"] = options

    if features.has("organizations:seer-run-mirror", organization):
        try:
            with outbox_context(transaction.atomic(using=router.db_for_write(SeerRun)), flush=True):
                run = SeerRun.objects.create(
                    organization=organization,
                    user_id=user_id,
                    type=SeerRunType.ASSISTED_QUERY,
                    last_triggered_at=now(),
                )
                CellOutbox(
                    shard_scope=OutboxScope.SEER_SCOPE,
                    shard_identifier=run.id,
                    category=OutboxCategory.SEER_RUN_CREATE,
                    object_identifier=run.id,
                    payload={
                        "body": dict(body),
                        "viewer_context": dict(viewer_context) if viewer_context else None,
                    },
                ).save()
        except (OutboxFlushError, OutboxDatabaseError):
            metrics.incr("seer.outbox_flush_error", tags={"type": "assisted_query"})
            logger.exception(
                "search_agent.outbox_flush_error",
                extra={
                    "organization_id": organization.id,
                    "seer_run_id": run.id,
                    "seer_run_uuid": str(run.uuid),
                },
            )
            run.mirror_status = SeerRunMirrorStatus.FAILED
            run.save(update_fields=["mirror_status"])
            raise SeerApiError("Outbox flush failed", 500)
        run.refresh_from_db()
        if run.mirror_status == SeerRunMirrorStatus.FAILED:
            raise SeerApiError("Seer run failed during outbox drain", 500)
        return run

    response = make_search_agent_start_request(body, timeout=30, viewer_context=viewer_context)
    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
    data = response.json()
    run_id = data.get("run_id")
    if run_id is None:
        logger.error(
            "search_agent.missing_run_id",
            extra={
                "organization_id": organization.id,
                "project_ids": project_ids,
                "response_data": data,
            },
        )
        raise SeerApiError("Seer response missing run_id", 500)
    return run_id


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
            )
            if isinstance(result, SeerRun):
                return Response(
                    {
                        "run_id": result.seer_run_state_id,
                        "sentry_run_id": str(result.uuid),
                    }
                )
            return Response({"run_id": result})

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
