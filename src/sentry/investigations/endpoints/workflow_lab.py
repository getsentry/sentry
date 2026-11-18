from typing import Any
from uuid import UUID

import orjson
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3.exceptions import HTTPError

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)


class WorkflowLabEndpoint(OrganizationNotebooksBaseEndpoint):
    requires_user = True

    def convert_args(
        self, request: Request, organization_id_or_slug: str | int, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        # The editor accepts arbitrary development workflow definitions.
        if not settings.DEBUG:
            raise ResourceDoesNotExist
        return super().convert_args(request, organization_id_or_slug, *args, **kwargs)

    def forward(self, method: str, path: str, *, operation: str, data: Any = None) -> Response:
        try:
            upstream = make_signed_seer_api_request(
                seer_autofix_default_connection_pool,
                "/v1/automation/workflow-lab" + path,
                method=method,
                body=b"" if data is None else orjson.dumps(data),
                metrics_endpoint="/v1/automation/workflow-lab/" + operation,
                timeout=100 if operation == "proof" else None,
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
class OrganizationWorkflowLabEndpoint(WorkflowLabEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        return self.forward("GET", "", operation="config")

    def post(self, request: Request, organization: Organization) -> Response:
        if not isinstance(request.data, dict):
            return Response({"detail": "Expected a workflow request."}, status=400)
        action = request.data.get("action")
        if action not in ("validate", "run", "proof"):
            return Response({"detail": "Unknown lab action."}, status=400)
        path = "/runs" if action == "run" else "/" + action
        return self.forward(
            "POST",
            path,
            operation=action,
            data={k: v for k, v in request.data.items() if k != "action"},
        )


@cell_silo_endpoint
class OrganizationWorkflowLabRunEndpoint(WorkflowLabEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        path = f"/runs/{UUID(run_id)}"
        if request.GET.get("activity") == "1":
            path += "?activity=true"
        return self.forward("GET", path, operation="status")

    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        if request.data != {"command": "cancel"}:
            return Response({"detail": "Unknown workflow command."}, status=400)
        return self.forward(
            "POST", f"/runs/{UUID(run_id)}/commands", operation="command", data=request.data
        )
