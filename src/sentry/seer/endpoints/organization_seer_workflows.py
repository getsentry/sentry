from __future__ import annotations

from collections.abc import Collection, Sequence
from functools import partial
from typing import TypedDict

from django.db.models import Exists, OuterRef, Q, prefetch_related_objects
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.seer_agentic_triage_run import (  # noqa: F401 -- registers serializer
    SeerAgenticTriageRunResponse,
    SeerAgenticTriageRunSerializer,
)
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.agentic_triage import SeerAgenticTriageRunResult
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy
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
        cleanup_enabled = features.has(
            "organizations:seer-workflows-monitor-cleanup", organization, actor=request.user
        )
        if not triage_enabled and not cleanup_enabled:
            raise NotFound

        # Owners, managers, and open membership can already open every project.
        # Everyone else only sees runs whose projects they can access.
        project_scoped = cleanup_enabled or (
            triage_enabled and not request.access.has_global_access
        )
        projects = (
            self.get_projects(request, organization, include_all_accessible=True)
            if project_scoped
            else []
        )
        accessible_project_ids = [project.id for project in projects]

        visible_runs = Q(pk__in=[])
        if triage_enabled:
            # Historical Agentic triage runs may not have a workflow config.
            triage_runs = Q(workflow_config__strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE) | Q(
                workflow_config__isnull=True
            )
            if request.access.has_global_access:
                visible_runs |= triage_runs
            else:
                visible_runs |= triage_runs & _triage_runs_visible_for_projects(
                    accessible_project_ids
                )
        if cleanup_enabled:
            # Until scanned projects are recorded, only the triggering user can see the run.
            cleanup_visibility = ~Q(executions__seer_run__agent__extras__project_ids=[])
            if request.user.is_authenticated:
                cleanup_visibility |= Q(executions__seer_run__user_id=request.user.id)
            visible_runs |= (
                Q(
                    workflow_config__strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
                    executions__seer_run__agent__extras__project_ids__contained_by=[
                        str(project.id) for project in projects
                    ],
                )
                & cleanup_visibility
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
            on_results=partial(
                serialize_workflow_page,
                request=request,
                accessible_project_ids=(
                    None if request.access.has_global_access else set(accessible_project_ids)
                ),
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
        run = create_monitor_cleanup_run(request, organization, source="manual")
        return Response({"runId": str(run.id)}, status=202)


def _triage_runs_visible_for_projects(accessible_project_ids: Sequence[int]) -> Q:
    """Runs whose declared projects, and every result group, are accessible.

    Manual runs store ``extras.target_project_ids``. Org-wide runs omit that
    list and only name projects through their result groups. A run with
    neither has no project payload.
    """
    if accessible_project_ids:
        outside_projects = SeerAgenticTriageRunResult.objects.filter(
            run_id=OuterRef("pk"),
            group_id__isnull=False,
        ).exclude(group__project_id__in=accessible_project_ids)
    else:
        outside_projects = SeerAgenticTriageRunResult.objects.filter(
            run_id=OuterRef("pk"),
            group_id__isnull=False,
        )
    # An empty target list is contained by every project list, so require a
    # non-empty list before treating containment as access.
    targets_declared = Q(extras__has_key="target_project_ids") & ~Q(extras__target_project_ids=[])
    targets_visible = Q(extras__target_project_ids__contained_by=list(accessible_project_ids))
    return ((targets_declared & targets_visible) | ~targets_declared) & ~Exists(outside_projects)


def serialize_workflow_page(
    runs: Sequence[SeerWorkflowRun],
    request: Request,
    accessible_project_ids: Collection[int] | None = None,
) -> list[SeerAgenticTriageRunResponse | MonitorCleanupRunResponse]:
    cleanup = [
        run
        for run in runs
        if run.workflow_config
        and run.workflow_config.strategy == SeerWorkflowStrategy.DUPLICATE_MONITORS
    ]
    triage = [run for run in runs if run not in cleanup]
    results: dict[str, SeerAgenticTriageRunResponse | MonitorCleanupRunResponse] = {
        result["id"]: result
        for result in serialize(
            triage,
            request.user,
            SeerAgenticTriageRunSerializer(),
            accessible_project_ids=accessible_project_ids,
        )
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
        "source": extras.get("source"),
        "seerRunId": run_uuid,
        "dateAdded": run.date_added,
        "dateCompleted": run.date_completed,
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
