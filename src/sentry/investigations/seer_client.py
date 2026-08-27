from __future__ import annotations

from typing import Any
from uuid import UUID, uuid5

import orjson
from django.conf import settings
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

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


def _post(
    path: str,
    body: dict[str, Any],
    *,
    viewer_context: SeerViewerContext,
    connection_pool: HTTPConnectionPool | None = None,
) -> dict[str, Any]:
    response = make_signed_seer_api_request(
        connection_pool or investigation_connection_pool,
        path,
        body=orjson.dumps(body),
        viewer_context=viewer_context,
    )
    return _decode_response(response)


def _get(
    path: str,
    *,
    viewer_context: SeerViewerContext,
    connection_pool: HTTPConnectionPool | None = None,
) -> dict[str, Any]:
    response = make_signed_seer_api_request(
        connection_pool or investigation_connection_pool,
        path,
        body=b"",
        method="GET",
        viewer_context=viewer_context,
    )
    return _decode_response(response)


def create_investigation_orchestration_run(
    run: InvestigationOrchestrationRun,
    *,
    viewer_context: SeerViewerContext,
    connection_pool: HTTPConnectionPool | None = None,
) -> dict[str, Any]:
    budget = run.source.get("activeTimeBudgetSeconds", 1800)
    if isinstance(budget, bool) or not isinstance(budget, int) or not 60 <= budget <= 1800:
        budget = 1800
    body: dict[str, Any] = {
        "requestId": str(
            uuid5(
                _CREATE_REQUEST_NAMESPACE,
                f"{run.investigation.organization_id}:{run.investigation_id}:{run.id}",
            )
        ),
        "investigationId": run.investigation_id,
        "source": run.source,
        "activeTimeBudgetSeconds": budget,
    }
    monitoring_providers = get_monitoring_provider_connections(
        run.investigation.organization,
        run.investigation.created_by_id,
    )
    if monitoring_providers:
        body["monitoringProviders"] = [provider.dict() for provider in monitoring_providers]
    return _post(
        "/v1/automation/investigations",
        body,
        viewer_context=viewer_context,
        connection_pool=connection_pool,
    )


def dispatch_investigation_orchestration_command(
    command: InvestigationOrchestrationCommand,
    *,
    seer_run_id: int,
    viewer_context: SeerViewerContext,
    connection_pool: HTTPConnectionPool | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "requestId": str(command.request_id),
        "expectedWorkflowVersion": command.expected_workflow_version,
        "command": {"type": command.type, **command.payload},
    }
    investigation = command.orchestration_run.investigation
    monitoring_providers = get_monitoring_provider_connections(
        investigation.organization,
        command.actor_id or investigation.created_by_id,
    )
    if monitoring_providers:
        body["monitoringProviders"] = [provider.dict() for provider in monitoring_providers]
    return _post(
        f"/v1/automation/investigations/{seer_run_id}/commands",
        body,
        viewer_context=viewer_context,
        connection_pool=connection_pool,
    )


def get_investigation_orchestration_run(
    seer_run_id: int,
    *,
    viewer_context: SeerViewerContext,
    connection_pool: HTTPConnectionPool | None = None,
) -> dict[str, Any]:
    return _get(
        f"/v1/automation/investigations/{seer_run_id}",
        viewer_context=viewer_context,
        connection_pool=connection_pool,
    )
