from __future__ import annotations

from typing import Any, Literal, TypedDict, cast
from uuid import UUID, uuid5

import orjson
from django.conf import settings
from pydantic import BaseModel, Field, StrictBool, StrictInt, ValidationError
from urllib3 import BaseHTTPResponse

from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationRun,
)
from sentry.net.http import connection_from_url
from sentry.seer.agent.monitoring_providers import get_monitoring_provider_connections
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request

_CREATE_REQUEST_NAMESPACE = UUID("3bed27f2-9ab9-49ce-8d64-7d78d5c3fd76")
investigation_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)


class InvestigationRunResponse(TypedDict):
    runId: int
    created: bool
    projection: dict[str, Any]


class InvestigationCommandResponse(TypedDict):
    runId: int
    requestId: str
    accepted: bool
    duplicate: bool
    workflowVersion: int
    projection: dict[str, Any]


class _InvestigationRunResponseModel(BaseModel):
    run_id: StrictInt = Field(alias="runId")
    created: StrictBool
    projection: dict[str, Any]


class _InvestigationCommandResponseModel(BaseModel):
    run_id: StrictInt = Field(alias="runId")
    request_id: UUID = Field(alias="requestId")
    accepted: Literal[True]
    duplicate: StrictBool
    workflow_version: StrictInt = Field(alias="workflowVersion")
    projection: dict[str, Any]


__all__ = [
    "InvestigationCommandResponse",
    "InvestigationRunResponse",
    "create_investigation_orchestration_run",
    "dispatch_investigation_orchestration_command",
    "get_investigation_orchestration_run",
]


def _decode_response(response: BaseHTTPResponse) -> dict[str, Any]:
    if response.status < 200 or response.status >= 300:
        raise SeerApiError("Investigation orchestration request failed", response.status)
    try:
        value = orjson.loads(response.data)
    except orjson.JSONDecodeError as error:
        raise SeerApiError("Seer returned an invalid response", 502) from error
    if not isinstance(value, dict):
        raise SeerApiError("Seer returned an invalid response", 502)
    return value


def _validate_run_response(value: dict[str, Any]) -> InvestigationRunResponse:
    try:
        model = _InvestigationRunResponseModel.parse_obj(value)
    except ValidationError as error:
        raise SeerApiError("Seer returned an invalid response", 502) from error
    if model.run_id < 1:
        raise SeerApiError("Seer returned an invalid response", 502)
    normalized = {
        "runId": model.run_id,
        "created": model.created,
        "projection": model.projection,
    }
    return cast(InvestigationRunResponse, normalized)


def _validate_command_response(value: dict[str, Any]) -> InvestigationCommandResponse:
    try:
        model = _InvestigationCommandResponseModel.parse_obj(value)
    except ValidationError as error:
        raise SeerApiError("Seer returned an invalid response", 502) from error
    if model.run_id < 1 or model.workflow_version < 1:
        raise SeerApiError("Seer returned an invalid response", 502)
    normalized = {
        "runId": model.run_id,
        "requestId": str(model.request_id),
        "accepted": model.accepted,
        "duplicate": model.duplicate,
        "workflowVersion": model.workflow_version,
        "projection": model.projection,
    }
    return cast(InvestigationCommandResponse, normalized)


def _post(
    path: str,
    body: dict[str, Any],
    *,
    viewer_context: SeerViewerContext,
) -> dict[str, Any]:
    response = make_signed_seer_api_request(
        investigation_connection_pool,
        path,
        body=orjson.dumps(body),
        viewer_context=viewer_context,
    )
    return _decode_response(response)


def _get(
    path: str,
    *,
    viewer_context: SeerViewerContext,
) -> dict[str, Any]:
    response = make_signed_seer_api_request(
        investigation_connection_pool,
        path,
        body=b"",
        method="GET",
        viewer_context=viewer_context,
    )
    return _decode_response(response)


def _validate_viewer_organization(
    viewer_context: SeerViewerContext,
    organization_id: int,
) -> None:
    if viewer_context.get("organization_id") != organization_id:
        raise SeerApiError("Viewer context organization does not match investigation", 400)


def create_investigation_orchestration_run(
    run: InvestigationOrchestrationRun,
    *,
    viewer_context: SeerViewerContext,
) -> InvestigationRunResponse:
    _validate_viewer_organization(viewer_context, run.investigation.organization_id)
    body: dict[str, Any] = {
        "requestId": str(
            uuid5(
                _CREATE_REQUEST_NAMESPACE,
                f"{run.investigation.organization_id}:{run.investigation_id}:{run.id}",
            )
        ),
        "investigationId": run.investigation_id,
        "source": run.source,
        "activeTimeBudgetSeconds": 1800,
    }
    monitoring_providers = get_monitoring_provider_connections(
        run.investigation.organization,
        run.investigation.created_by_id,
    )
    if monitoring_providers:
        body["monitoringProviders"] = [provider.dict() for provider in monitoring_providers]
    response = _post(
        "/v1/automation/investigations",
        body,
        viewer_context=viewer_context,
    )
    return _validate_run_response(response)


def dispatch_investigation_orchestration_command(
    command: InvestigationOrchestrationCommand,
    *,
    viewer_context: SeerViewerContext,
) -> InvestigationCommandResponse:
    investigation = command.orchestration_run.investigation
    _validate_viewer_organization(viewer_context, investigation.organization_id)
    seer_run = command.orchestration_run.seer_run
    seer_run_id = seer_run.seer_run_state_id if seer_run is not None else None
    if seer_run_id is None:
        raise SeerApiError("Investigation has no Seer run", 409)
    body: dict[str, Any] = {
        "requestId": str(command.request_id),
        "expectedWorkflowVersion": command.expected_workflow_version,
        "command": {"type": command.type, **command.payload},
    }
    monitoring_providers = get_monitoring_provider_connections(
        investigation.organization,
        command.actor_id or investigation.created_by_id,
    )
    if monitoring_providers:
        body["monitoringProviders"] = [provider.dict() for provider in monitoring_providers]
    response = _post(
        f"/v1/automation/investigations/{seer_run_id}/commands",
        body,
        viewer_context=viewer_context,
    )
    return _validate_command_response(response)


def get_investigation_orchestration_run(
    run: InvestigationOrchestrationRun,
    *,
    viewer_context: SeerViewerContext,
) -> InvestigationRunResponse:
    _validate_viewer_organization(viewer_context, run.investigation.organization_id)
    seer_run = run.seer_run
    seer_run_id = seer_run.seer_run_state_id if seer_run is not None else None
    if seer_run_id is None:
        raise SeerApiError("Investigation has no Seer run", 409)
    response = _get(
        f"/v1/automation/investigations/{seer_run_id}",
        viewer_context=viewer_context,
    )
    return _validate_run_response(response)
