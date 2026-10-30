from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Literal, TypedDict

from django.db.models import F, Prefetch, prefetch_related_objects
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
from sentry.apidocs.examples import seer_workflow_examples as SeerWorkflowExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.db.models.fields.bounded import I64_MAX
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.models.workflow import (
    SEER_CONFIGURABLE_WORKFLOW_STRATEGIES,
    SeerWorkflowExecutionStatus,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
)
from sentry.seer.monitor_cleanup.runs import create_monitor_cleanup_run
from sentry.types.ratelimit import RateLimit, RateLimitCategory


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


class SeerWorkflowExecutionResponseBase(TypedDict):
    id: str
    seerRunId: str | None
    dateAdded: datetime
    dateUpdated: datetime
    dateCompleted: datetime | None


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


class SeerWorkflowRunResponseBase(TypedDict):
    id: str
    configId: str
    strategy: str
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

        ``config`` filters by one config ID; omit it for organization-wide history.
        Invalid or repeated IDs return 400; no visible matches return ``{"runs": []}``.
        Pagination links are in headers.

        ``status`` distinguishes failed/rejected records, which include an ``error``
        code and display-safe message, from other records, which omit ``error``.
        A run fails or is rejected in one of two ways:

        - Rejected (e.g. over quota) or failed before starting any execution: the
          run's ``error`` says why and it has no executions.
        - Failed because one or more executions failed: the run's ``error`` is null
          and each failed execution carries its own ``error``.

        Missing error details use code ``unknown``. Historical rows without lifecycle
        tracking retain a null status. ``seerRunId`` is the linked Seer UUID or null.
        Limited-access members must be able to access every project in the saved run
        snapshot; runs without a saved scope are hidden from them.
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
        ).annotate(strategy=F("workflow_config__strategy"))
        config_id = serializer.validated_data.get("config")
        if config_id is not None:
            runs = runs.filter(workflow_config_id=config_id)
        if not request.access.has_global_access:
            projects = self.get_projects(request, organization, include_all_accessible=True)
            runs = runs.filter(
                extras__snapshot__project_ids__contained_by=[project.id for project in projects]
            )

        return self.paginate(
            request=request,
            queryset=runs,
            order_by=("-date_added", "-id"),
            paginator_cls=OffsetPaginator,
            on_results=serialize_workflow_runs,
        )

    @extend_schema(
        operation_id="Start a Seer workflow run",
        request=WorkflowRunCreateSerializer,
        responses={
            202: inline_sentry_response_serializer(
                "SeerWorkflowRunCreate", WorkflowRunCreateResponse
            ),
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        serializer = WorkflowRunCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        run = create_monitor_cleanup_run(request, organization, source="manual")
        return Response({"runId": str(run.id)}, status=202)


def serialize_workflow_runs(runs: Sequence[SeerWorkflowRun]) -> SeerWorkflowRunsResponse:
    """Serialize runs loaded with a `workflow_config__strategy` annotation."""
    prefetch_related_objects(
        runs,
        Prefetch(
            "executions",
            queryset=SeerWorkflowRunExecution.objects.select_related("seer_run").order_by("id"),
        ),
    )
    return {"runs": [serialize_workflow_run(run) for run in runs]}


def serialize_workflow_run(run: SeerWorkflowRun) -> SeerWorkflowRunResponse:
    """Serialize a run loaded with a `workflow_config__strategy` annotation."""
    result: SeerWorkflowRunResponseBase = {
        "id": str(run.id),
        "configId": str(run.workflow_config_id),
        "strategy": getattr(run, "strategy"),
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
