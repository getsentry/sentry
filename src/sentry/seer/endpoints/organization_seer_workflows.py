from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from functools import partial
from typing import TypedDict

from django.db.models import Q, prefetch_related_objects
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, Throttled
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.seer_night_shift_run import (  # noqa: F401 -- registers serializer
    SeerNightShiftRunResponse,
    SeerNightShiftRunSerializer,
)
from sentry.models.organization import Organization
from sentry.ratelimits import backend as ratelimits
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy
from sentry.seer.monitor_cleanup.constants import FEATURE
from sentry.seer.monitor_cleanup.runs import create_monitor_cleanup_run
from sentry.seer.monitor_cleanup.schemas import MonitorCleanupRunExtras, MonitorCleanupRunResponse
from sentry.seer.workflows.runs import get_workflow_run_status
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class WorkflowRunCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(choices=[SeerWorkflowStrategy.DUPLICATE_MONITORS])


class WorkflowRunCreateResponse(TypedDict):
    runId: str


class OrganizationSeerWorkflowsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerWorkflowsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerWorkflowsPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=1, window=60),
            },
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        triage_enabled = features.has("organizations:seer-night-shift", organization)
        cleanup_enabled = features.has(FEATURE, organization, actor=request.user)
        if not triage_enabled and not cleanup_enabled:
            raise NotFound

        visible_runs = Q(pk__in=[])
        if triage_enabled:
            # Historical Night Shift runs may not have a workflow config.
            visible_runs |= Q(workflow_config__strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE) | Q(
                workflow_config__isnull=True
            )
        if cleanup_enabled:
            projects = self.get_projects(request, organization, include_all_accessible=True)
            visible_runs |= Q(
                workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                executions__seer_run__agent__extras__project_ids__contained_by=[
                    str(project.id) for project in projects
                ],
            )

        runs = (
            SeerWorkflowRun.objects.filter(visible_runs, organization=organization)
            .select_related("workflow_config")
            .distinct()
        )

        return self.paginate(
            request=request,
            queryset=runs,
            order_by=("-date_added", "-id"),
            on_results=partial(serialize_workflow_page, request=request),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Start a Seer workflow run",
        request=WorkflowRunCreateSerializer,
        responses={202: WorkflowRunCreateResponse},
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = WorkflowRunCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        strategy = serializer.validated_data["strategy"]
        # RateLimitConfig limits browser sessions per user; this cap is shared across the org.
        if ratelimits.is_limited(
            f"seer-workflow:{organization.id}:{strategy}", limit=5, window=3600
        ):
            raise Throttled(detail="This organization has reached its scan limit. Try again later.")
        run = create_monitor_cleanup_run(request, organization)
        return Response({"runId": str(run.id)}, status=202)


def serialize_workflow_page(
    runs: Sequence[SeerWorkflowRun],
    request: Request,
) -> list[SeerNightShiftRunResponse | MonitorCleanupRunResponse]:
    cleanup = [
        run
        for run in runs
        if run.workflow_config
        and run.workflow_config.strategy == SeerWorkflowStrategy.DUPLICATE_MONITORS
    ]
    triage = [run for run in runs if run not in cleanup]
    results: dict[str, SeerNightShiftRunResponse | MonitorCleanupRunResponse] = {
        result["id"]: result
        for result in serialize(triage, request.user, SeerNightShiftRunSerializer())
    }
    prefetch_related_objects(cleanup, "executions__seer_run__agent")
    for run in cleanup:
        results[str(run.id)] = _serialize_monitor_cleanup_run(run)
    return [results[str(run.id)] for run in runs]


def _serialize_monitor_cleanup_run(run: SeerWorkflowRun) -> MonitorCleanupRunResponse:
    execution = run.executions.all()[0]
    assert execution.seer_run is not None
    agent_run = execution.seer_run.agent
    extras: MonitorCleanupRunExtras = agent_run.extras
    status = get_workflow_run_status(agent_run)
    run_uuid = str(agent_run.run.uuid)
    return {
        "id": str(run.id),
        "seerRunId": run_uuid,
        "dateAdded": run.date_added,
        "dateCompleted": datetime.fromisoformat(status["date_completed"])
        if status["date_completed"] is not None
        else None,
        "strategy": "duplicate_monitors",
        "extras": {"status": status["status"]},
        "errorMessage": status["error"],
        "results": [
            {
                "id": f"{run_uuid}:{output['projectId']}",
                "kind": "duplicate_monitors",
                "seerRunId": run_uuid,
                "extras": output,
            }
            for output in extras["results"]
        ],
    }
