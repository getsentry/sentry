from typing import Any
from uuid import UUID

import orjson
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3.exceptions import HTTPError

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)


class WorkflowEndpoint(OrganizationNotebooksBaseEndpoint):
    requires_user = True

    def forward(self, method: str, path: str, *, operation: str, data: Any = None) -> Response:
        try:
            upstream = make_signed_seer_api_request(
                seer_autofix_default_connection_pool,
                "/v1/automation/investigation-workflows" + path,
                method=method,
                body=b"" if data is None else orjson.dumps(data),
                metrics_endpoint="/v1/automation/investigation-workflows/" + operation,
                retries=False,
            )
        except HTTPError:
            return Response({"detail": "Could not reach Seer."}, status=502)
        if upstream.status >= 500:
            return Response({"detail": "Seer could not complete the workflow request."}, status=502)
        try:
            body = orjson.loads(upstream.data)
        except orjson.JSONDecodeError:
            return Response({"detail": "Invalid workflow response from Seer."}, status=502)
        if (
            upstream.status == 422
            and isinstance(body, dict)
            and isinstance(body.get("detail"), list)
        ):
            messages = [
                f"{'.'.join(map(str, issue.get('loc', [])))} — {issue['msg']}"
                for issue in body["detail"]
                if isinstance(issue, dict) and "msg" in issue
            ]
            return Response({"detail": "\n".join(messages)}, status=422)
        return Response(body, status=upstream.status)


@cell_silo_endpoint
class OrganizationWorkflowRunsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        return self.forward("POST", "/runs", operation="runs", data=request.data)


@cell_silo_endpoint
class OrganizationWorkflowRunEndpoint(WorkflowEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        path = f"/runs/{UUID(run_id)}"
        if request.GET.get("activity") == "1":
            path += "?activity=true"
        return self.forward("GET", path, operation="status")


@cell_silo_endpoint
class OrganizationWorkflowCommandsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        return self.forward(
            "POST", f"/runs/{UUID(run_id)}/commands", operation="commands", data=request.data
        )
