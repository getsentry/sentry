from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence, Set
from datetime import datetime
from typing import Literal, NamedTuple, TypedDict

from django.db.models import F, Prefetch, Q, prefetch_related_objects
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError
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
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST
from sentry.apidocs.examples import seer_workflow_examples as SeerWorkflowExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.db.models.fields.bounded import I64_MAX
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.notebooks.access import has_notebooks_access
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunExtras,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.monitor_cleanup.runs import create_monitor_cleanup_run
from sentry.seer.workflows.breached_metrics import MetricBreachInputs
from sentry.seer.workflows.definitions import is_scheduled
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.safe import get_path
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


class WorkflowRunCreateSerializer(serializers.Serializer):
    strategy = serializers.ChoiceField(choices=[SeerWorkflowStrategy.DUPLICATE_MONITORS])


class WorkflowRunCreateResponse(TypedDict):
    runId: str


class WorkflowRunListSerializer(serializers.Serializer):
    config = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=I64_MAX,
        help_text="The workflow config ID to filter runs by. Omit to list runs across configs.",
    )


class WorkflowRunListErrorResponse(TypedDict):
    detail: str | dict[str, list[str]]


class SeerWorkflowErrorResponse(TypedDict):
    code: str
    message: str


class SeerWorkflowInvestigationOutputResponse(TypedDict):
    type: Literal["investigation"]
    id: str
    title: str


class SeerWorkflowExecutionResponseBase(TypedDict):
    id: str
    seerRunId: str | None
    dateAdded: datetime
    dateUpdated: datetime
    dateCompleted: datetime | None
    outputs: list[SeerWorkflowInvestigationOutputResponse]


class SeerWorkflowExecutionStateResponse(SeerWorkflowExecutionResponseBase):
    status: (
        Literal[
            SeerWorkflowExecutionStatus.QUEUED,
            SeerWorkflowExecutionStatus.RUNNING,
            SeerWorkflowExecutionStatus.COMPLETE,
        ]
        | None
    )


class SeerWorkflowExecutionErrorResponse(SeerWorkflowExecutionResponseBase):
    status: Literal[SeerWorkflowExecutionStatus.FAILED]
    error: SeerWorkflowErrorResponse


SeerWorkflowExecutionResponse = (
    SeerWorkflowExecutionStateResponse | SeerWorkflowExecutionErrorResponse
)


class MonitorTriggerResponse(TypedDict):
    type: Literal["monitor"]
    detectorId: str
    detectorName: str | None  # queried separately (not in trigger input)
    environment: str | None
    eventId: str
    groupExists: bool  # queried separately (not in trigger input)
    groupId: str
    groupShortId: str | None
    observedAt: datetime
    occurrenceId: str
    projectId: str


class CronTriggerResponse(TypedDict):
    # TODO: Include triggeredAt (parsed from trigger_key) once cron strategies such as
    # AGENTIC_TRIAGE_V2 start creating runs.
    type: Literal["cron"]


# Discriminated by `type`; add new trigger variants to this union.
TriggerResponse = MonitorTriggerResponse | CronTriggerResponse


class SeerWorkflowRunResponseBase(TypedDict):
    id: str
    configId: str
    configName: str | None
    strategy: str
    trigger: TriggerResponse | None
    dateAdded: datetime
    dateUpdated: datetime
    dateCompleted: datetime | None
    executions: list[SeerWorkflowExecutionResponse]


class SeerWorkflowRunStateResponse(SeerWorkflowRunResponseBase):
    status: (
        Literal[
            SeerWorkflowRunStatus.QUEUED,
            SeerWorkflowRunStatus.RUNNING,
            SeerWorkflowRunStatus.COMPLETE,
        ]
        | None
    )


class SeerWorkflowRunErrorResponse(SeerWorkflowRunResponseBase):
    status: Literal[SeerWorkflowRunStatus.FAILED, SeerWorkflowRunStatus.REJECTED]
    error: SeerWorkflowErrorResponse | None


SeerWorkflowRunResponse = SeerWorkflowRunStateResponse | SeerWorkflowRunErrorResponse


class SeerWorkflowRunsResponse(TypedDict):
    runs: list[SeerWorkflowRunResponse]


class DetectorInfo(NamedTuple):
    project_id: int | None
    name: str


class OrganizationSeerWorkflowRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }


@cell_silo_endpoint
@extend_schema(tags=["Seer"])
class OrganizationSeerWorkflowRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerWorkflowRunsPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.USER: RateLimit(limit=1, window=60),
            },
        }
    )

    @extend_schema(
        operation_id="List Seer workflow runs",
        examples=SeerWorkflowExamples.WORKFLOW_RUNS_RESPONSE,
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam, WorkflowRunListSerializer],
        responses={
            200: inline_sentry_response_serializer("SeerWorkflowRuns", SeerWorkflowRunsResponse),
            400: inline_sentry_response_serializer(
                "SeerWorkflowRunListError", WorkflowRunListErrorResponse
            ),
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """List automation runs with their executions, newest first.

        Limited-access members see a run started by a trigger in one project (such as a
        monitor) when they can access that project. For other runs they must be able to
        access every project in the saved run snapshot; runs without a saved scope are
        hidden from them.

        Execution ``outputs`` are empty without investigation access.
        """
        if not features.has("organizations:seer-automations", organization, actor=request.user):
            raise NotFound

        if len(request.query_params.getlist("config")) > 1:
            return Response({"detail": "Supply only one config."}, status=400)
        serializer = WorkflowRunListSerializer(data=request.query_params.dict())
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)

        runs = SeerWorkflowRun.objects.filter(
            organization=organization,
            workflow_config__organization=organization,
            workflow_config__strategy__in=SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
        ).annotate(
            strategy=F("workflow_config__strategy"),
            config_extras=F("workflow_config__extras"),
        )

        # Filter by a config
        config_id = serializer.validated_data.get("config")
        if config_id is not None:
            runs = runs.filter(workflow_config_id=config_id)

        # Filter by accessible projects. A run started by a trigger in one project only needs
        # access to that project; other runs need access to every project in their saved scope.
        accessible_project_ids: set[int] | None = None
        if not request.access.has_global_access:
            projects = self.get_projects(request, organization, include_all_accessible=True)
            accessible_project_ids = {project.id for project in projects}
            runs = runs.filter(
                Q(extras__snapshot__inputs__project_id__in=accessible_project_ids)
                | Q(
                    extras__snapshot__inputs__project_id__isnull=True,
                    extras__snapshot__project_ids__contained_by=list(accessible_project_ids),
                )
            )

        return self.paginate(
            request=request,
            queryset=runs,
            order_by=("-date_added", "-id"),
            paginator_cls=OffsetPaginator,
            on_results=lambda runs: serialize_workflow_runs(
                runs,
                # TODO(telkins): Align automation and investigation access checks instead of
                # returning empty outputs for otherwise visible runs.
                include_investigations=has_notebooks_access(organization, actor=request.user),
                accessible_project_ids=accessible_project_ids,
            ),
        )

    @extend_schema(
        operation_id="Start a Seer workflow run",
        request=WorkflowRunCreateSerializer,
        responses={
            202: inline_sentry_response_serializer(
                "SeerWorkflowRunCreate", WorkflowRunCreateResponse
            ),
            400: RESPONSE_BAD_REQUEST,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = WorkflowRunCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        run = create_monitor_cleanup_run(request, organization, source="manual")
        return Response({"runId": str(run.id)}, status=202)


def serialize_workflow_runs(
    runs: Sequence[SeerWorkflowRun],
    *,
    include_investigations: bool,
    accessible_project_ids: set[int] | None = None,
) -> SeerWorkflowRunsResponse:
    """Serialize runs loaded with `strategy` and `config_extras` annotations.

    `accessible_project_ids` limits detector names to those projects; None means all.
    """
    output_links = SeerWorkflowOutputLink.objects.select_related("notebook").order_by("id")
    if not include_investigations:
        output_links = output_links.none()
    prefetch_related_objects(
        runs,
        Prefetch(
            "executions",
            queryset=SeerWorkflowRunExecution.objects.select_related("seer_run").order_by("id"),
        ),
        Prefetch("executions__output_links", queryset=output_links),
    )
    organization_ids = {run.organization_id for run in runs}
    detector_ids = {
        detector_id
        for run in runs
        if isinstance(detector_id := get_path(run.extras, "snapshot", "inputs", "detector_id"), int)
    }
    group_ids = {
        group_id
        for run in runs
        if isinstance(group_id := get_path(run.extras, "snapshot", "inputs", "group_id"), int)
    }
    # One query each for the whole page; skipped when no run was started by a monitor.
    detectors = (
        {
            detector_id: DetectorInfo(project_id, name)
            for detector_id, project_id, name in Detector.objects.filter(
                id__in=detector_ids,
                project__organization_id__in=organization_ids,
            ).values_list("id", "project_id", "name")
        }
        if detector_ids
        else {}
    )
    existing_group_ids = (
        set(
            Group.objects.filter(id__in=group_ids, project__organization_id__in=organization_ids)
            .exclude(status__in=(GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS))
            .values_list("id", flat=True)
        )
        if group_ids
        else set()
    )
    return {
        "runs": [
            serialize_workflow_run(
                run,
                detectors=detectors,
                existing_group_ids=existing_group_ids,
                accessible_project_ids=accessible_project_ids,
            )
            for run in runs
        ]
    }


def serialize_workflow_run(
    run: SeerWorkflowRun,
    *,
    detectors: Mapping[int, DetectorInfo],
    existing_group_ids: Set[int],
    accessible_project_ids: set[int] | None,
) -> SeerWorkflowRunResponse:
    """Serialize a run loaded with `strategy` and `config_extras` annotations."""
    config_extras = getattr(run, "config_extras")
    config_name = config_extras.get("name") if isinstance(config_extras, dict) else None
    result: SeerWorkflowRunResponseBase = {
        "id": str(run.id),
        "configId": str(run.workflow_config_id),
        "configName": config_name if isinstance(config_name, str) else None,
        "strategy": getattr(run, "strategy"),
        "trigger": serialize_trigger(
            run,
            detectors=detectors,
            existing_group_ids=existing_group_ids,
            accessible_project_ids=accessible_project_ids,
        ),
        "dateAdded": run.date_added,
        "dateUpdated": run.date_updated,
        "dateCompleted": run.date_completed,
        "executions": [
            serialize_workflow_execution(execution, organization_id=run.organization_id)
            for execution in run.executions.all()
        ],
    }
    status = SeerWorkflowRunStatus(run.status) if run.status is not None else None
    if status == SeerWorkflowRunStatus.FAILED or status == SeerWorkflowRunStatus.REJECTED:
        error = run.extras.get("error")
        return {
            **result,
            "status": status,
            "error": serialize_workflow_error(error) if error is not None else None,
        }
    return {**result, "status": status}


def serialize_trigger(
    run: SeerWorkflowRun,
    *,
    detectors: Mapping[int, DetectorInfo],
    existing_group_ids: Set[int],
    accessible_project_ids: set[int] | None,
) -> TriggerResponse | None:
    """Serialize the trigger of a run loaded with a `workflow_config__strategy` annotation.

    `detectors` maps each preloaded detector's ID to its current project and name. The
    name is only returned when the detector still belongs to the trigger's project and
    that project is in `accessible_project_ids` (None means all projects).
    `existing_group_ids` holds the preloaded IDs of trigger groups that have not been deleted.
    """
    strategy = getattr(run, "strategy")
    if is_scheduled(strategy):
        return {"type": "cron"}
    if strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION and get_path(
        run.extras, "snapshot", "inputs"
    ):
        try:
            inputs = SeerWorkflowRunExtras.parse_obj(run.extras).snapshot.inputs
            trigger = MetricBreachInputs.parse_obj(inputs)
            detector = detectors.get(trigger.detector_id)
            if detector is not None and (
                detector.project_id != trigger.project_id
                or (
                    accessible_project_ids is not None
                    and trigger.project_id not in accessible_project_ids
                )
            ):
                detector = None
            return {
                "type": "monitor",
                "detectorId": str(trigger.detector_id),
                "detectorName": detector.name if detector is not None else None,
                "environment": trigger.environment,
                "eventId": trigger.event_id,
                "groupExists": trigger.group_id in existing_group_ids,
                "groupId": str(trigger.group_id),
                "groupShortId": trigger.group_short_id,
                "observedAt": trigger.observed_at,
                "occurrenceId": trigger.occurrence_id,
                "projectId": str(trigger.project_id),
            }
        except ValidationError:
            logger.exception("seer.workflow_run.invalid_trigger", extra={"run_id": run.id})
    return None


def serialize_workflow_execution(
    execution: SeerWorkflowRunExecution, *, organization_id: int
) -> SeerWorkflowExecutionResponse:
    seer_run = execution.seer_run
    result: SeerWorkflowExecutionResponseBase = {
        "id": str(execution.id),
        "seerRunId": (
            str(seer_run.uuid)
            if seer_run is not None and seer_run.organization_id == organization_id
            else None
        ),
        "dateAdded": execution.date_added,
        "dateUpdated": execution.date_updated,
        "dateCompleted": execution.date_completed,
        "outputs": [
            {"type": "investigation", "id": str(link.notebook.id), "title": link.notebook.title}
            for link in execution.output_links.all()
            if link.notebook is not None and link.notebook.organization_id == organization_id
        ],
    }
    status = SeerWorkflowExecutionStatus(execution.status) if execution.status is not None else None
    if status == SeerWorkflowExecutionStatus.FAILED:
        return {
            **result,
            "status": status,
            "error": serialize_workflow_error(execution.extras.get("error")),
        }
    return {**result, "status": status}


def serialize_workflow_error(error: object) -> SeerWorkflowErrorResponse:
    if isinstance(error, dict):
        code = error.get("code")
        message = error.get("message")
        if isinstance(code, str) and isinstance(message, str):
            return {"code": code, "message": message}
    return {"code": "unknown", "message": "No error details are available."}
