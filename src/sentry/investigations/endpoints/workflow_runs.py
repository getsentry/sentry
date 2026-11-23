from uuid import UUID

from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.models import WorkflowRun
from sentry.investigations.services.workflow_client import forward_workflow_request
from sentry.investigations.services.workflow_runtime import public_snapshot
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint, user_id


class WorkflowEndpoint(OrganizationNotebooksBaseEndpoint):
    requires_user = True


@cell_silo_endpoint
class OrganizationWorkflowRunsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization) -> Response:
        payload: object = request.data
        if not isinstance(payload, dict):
            return Response({"detail": "Expected a workflow request object."}, status=400)
        return forward_workflow_request("POST", "/runs", operation="runs", data=payload)


@cell_silo_endpoint
class OrganizationWorkflowRunEndpoint(WorkflowEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        with transaction.atomic(using=router.db_for_write(WorkflowRun)):
            run = (
                WorkflowRun.objects.select_for_update()
                .filter(organization=organization, uuid=run_id, user_id=user_id(request))
                .get_or_none()
            )
            if run is None:
                raise ResourceDoesNotExist
            return Response(public_snapshot(run, activity=request.GET.get("activity") == "1"))


@cell_silo_endpoint
class OrganizationWorkflowCommandsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        return forward_workflow_request(
            "POST", f"/runs/{UUID(str(run_id))}/commands", operation="commands", data=request.data
        )
