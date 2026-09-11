from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from functools import partial
from typing import Literal, TypedDict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import QuerySet, Value
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, Throttled, ValidationError
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
from sentry.seer.models.night_shift import SeerNightShiftRun
from sentry.seer.models.run import SeerAgentRun, SeerRun
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.monitor_cleanup import FEATURE, FEATURE_ID
from sentry.seer.monitor_cleanup.runs import create_monitor_cleanup_run
from sentry.seer.monitor_cleanup.schemas import MonitorCleanupRunExtras, MonitorCleanupRunResponse
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class WorkflowHistoryEntry(TypedDict):
    id: int
    date_added: datetime
    run_kind: Literal["night_shift", "monitor_cleanup"]


class WorkflowRunCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(choices=[SeerWorkflowStrategy.DUPLICATE_MONITORS])


class WorkflowRunCreateResponse(TypedDict):
    runId: str
    url: str


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

        night_shift_runs = SeerNightShiftRun.objects.none()
        if triage_enabled:
            night_shift_runs = SeerNightShiftRun.objects.filter(organization=organization)
        cleanup_runs = SeerRun.objects.none()
        if cleanup_enabled:
            projects = self.get_projects(request, organization, include_all_accessible=True)
            cleanup_runs = SeerRun.objects.filter(
                organization=organization,
                agent__source=FEATURE_ID,
                agent__extras__project_ids__contained_by=[str(project.id) for project in projects],
            )

        if run_id := request.GET.get("runId"):
            try:
                cleanup_runs = cleanup_runs.filter(uuid=run_id)
            except DjangoValidationError:
                cleanup_runs = cleanup_runs.none()
                try:
                    night_shift_runs = night_shift_runs.filter(id=run_id)
                except (ValueError, AssertionError):
                    raise ValidationError({"detail": "Enter a valid run ID."}) from None
            else:
                night_shift_runs = night_shift_runs.none()

        history = (
            night_shift_runs.annotate(run_kind=Value("night_shift"))
            .values("id", "date_added", "run_kind")
            .union(
                cleanup_runs.annotate(run_kind=Value("monitor_cleanup")).values(
                    "id", "date_added", "run_kind"
                ),
                all=True,
            )
        )

        return self.paginate(
            request=request,
            queryset=history,
            order_by=("-date_added", "-id", "run_kind"),
            on_results=partial(
                serialize_workflow_page,
                request=request,
                night_shift_runs=night_shift_runs,
                cleanup_runs=cleanup_runs,
            ),
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
        if ratelimits.is_limited(
            f"seer-workflow:{organization.id}:{strategy}", limit=5, window=3600
        ):
            raise Throttled(detail="This organization has reached its scan limit. Try again later.")
        run = create_monitor_cleanup_run(request, organization)
        return Response(
            {
                "runId": str(run.uuid),
                "url": f"/organizations/{organization.slug}/issues/autofix/workflows/?runId={run.uuid}&expandLatest={strategy}",
            },
            status=202,
        )


def serialize_workflow_page(
    entries: Sequence[WorkflowHistoryEntry],
    request: Request,
    night_shift_runs: QuerySet[SeerNightShiftRun],
    cleanup_runs: QuerySet[SeerRun],
) -> list[SeerNightShiftRunResponse | MonitorCleanupRunResponse]:
    triage = night_shift_runs.filter(
        id__in=[entry["id"] for entry in entries if entry["run_kind"] == "night_shift"],
    )
    cleanup = cleanup_runs.filter(
        id__in=[entry["id"] for entry in entries if entry["run_kind"] == "monitor_cleanup"],
    ).select_related("agent")
    results: dict[tuple[str, int], SeerNightShiftRunResponse | MonitorCleanupRunResponse] = {
        ("night_shift", int(result["id"])): result
        for result in serialize(list(triage), request.user, SeerNightShiftRunSerializer())
    }
    for run in cleanup:
        results[("monitor_cleanup", run.id)] = _serialize_monitor_cleanup_run(run.agent)
    return [results[(entry["run_kind"], entry["id"])] for entry in entries]


def _serialize_monitor_cleanup_run(agent_run: SeerAgentRun) -> MonitorCleanupRunResponse:
    extras: MonitorCleanupRunExtras = agent_run.extras
    run_uuid = str(agent_run.run.uuid)
    return {
        "id": run_uuid,
        "dateAdded": agent_run.run.date_added,
        "dateCompleted": datetime.fromisoformat(extras["date_completed"])
        if extras["date_completed"] is not None
        else None,
        "strategy": "duplicate_monitors",
        "extras": {"status": extras["status"]},
        "errorMessage": extras["error"],
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
