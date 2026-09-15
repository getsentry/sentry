from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from rest_framework.exceptions import NotFound, PermissionDenied, Throttled
from rest_framework.request import Request

from sentry import features
from sentry.models.organization import Organization
from sentry.ratelimits import backend as ratelimits
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun
from sentry.seer.models.workflow import SeerWorkflowRun, SeerWorkflowStrategy
from sentry.seer.monitor_cleanup.results import parse_monitor_cleanup_results
from sentry.seer.monitor_cleanup.schemas import SeerMonitorCleanupResponse
from sentry.seer.workflows.runs import create_workflow_run, deliver_workflow_result
from sentry.seer.workflows.schemas import WorkflowResult, WorkflowResultError
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


def create_monitor_cleanup_run(request: Request, organization: Organization) -> SeerWorkflowRun:
    if not features.has(
        "organizations:seer-workflows-monitor-cleanup", organization, actor=request.user
    ):
        raise NotFound
    if not request.user.is_authenticated:
        raise PermissionDenied("Sign in to run a monitor scan.")
    try:
        client = SeerAgentClient(organization=organization, user=cast(User | RpcUser, request.user))
    except SeerPermissionError as error:
        raise PermissionDenied("Seer is not available for this organization.") from error
    if ratelimits.is_limited(
        f"seer-workflow:{organization.id}:{SeerWorkflowStrategy.DUPLICATE_MONITORS}",
        limit=5,
        window=3600,
    ):
        raise Throttled(detail="This organization has reached its scan limit. Try again later.")
    return create_workflow_run(
        client,
        strategy=SeerWorkflowStrategy.DUPLICATE_MONITORS,
        feature_id="monitor_cleanup",
        payload={"response_version": 1},
        title="Monitor cleanup",
        extras={"project_ids": [], "results": []},
    )


def deliver_monitor_cleanup_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    deliver_workflow_result(
        feature_id="monitor_cleanup",
        organization_id=organization_id,
        run_uuid=run_uuid,
        status=status,
        result=result,
        error=error,
        parse_result=_parse_result,
    )


def _parse_result(result: dict[str, Any], agent_run: SeerAgentRun) -> WorkflowResult:
    if agent_run.run.user_id is None:
        raise WorkflowResultError("The triggering user no longer exists.")
    response = SeerMonitorCleanupResponse.parse_obj(result)
    outputs = parse_monitor_cleanup_results(
        response.data, agent_run.run.organization, agent_run.run.user_id
    )
    scan_status = response.data.scan_status
    if any(project.scan_status == "partial" for project in response.data.projects):
        scan_status = "partial"
    return WorkflowResult(
        status=scan_status,
        extras={"project_ids": [output["projectId"] for output in outputs], "results": outputs},
    )
