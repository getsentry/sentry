from uuid import UUID

from django.db import router, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.parameters import GlobalParams
from sentry.investigations.models import WorkflowRun
from sentry.investigations.services.workflow_client import forward_workflow_request
from sentry.investigations.services.workflow_runtime import public_snapshot
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint, user_id

RUN_ID = OpenApiParameter(
    name="run_id",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.PATH,
    description="The UUID returned when the workflow started.",
)


class StartWorkflowRequest(serializers.Serializer):
    workflow = serializers.CharField(help_text="The registered workflow name.")
    input = serializers.DictField(help_text="Input fields declared by the workflow.")
    requestId = serializers.UUIDField(help_text="A stable request ID used to deduplicate retries.")
    maxAttempts = serializers.IntegerField(
        required=False, min_value=1, max_value=10, help_text="Maximum attempts for a node."
    )


class WorkflowCommandRequest(serializers.Serializer):
    command = serializers.ChoiceField(choices=["cancel"], help_text="The command to deliver.")


@extend_schema(tags=["Investigations"], parameters=[GlobalParams.ORG_ID_OR_SLUG])
class WorkflowEndpoint(OrganizationNotebooksBaseEndpoint):
    requires_user = True


@cell_silo_endpoint
class OrganizationWorkflowRunsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(request=StartWorkflowRequest, responses={200: OpenApiTypes.OBJECT})
    def post(self, request: Request, organization: Organization) -> Response:
        """Start an investigation workflow and retrieve its run ID and notebook flag."""
        payload: object = request.data
        if not isinstance(payload, dict):
            return Response({"detail": "Expected a workflow request object."}, status=400)
        return forward_workflow_request("POST", "/runs", operation="runs", data=payload)


@cell_silo_endpoint
class OrganizationWorkflowRunEndpoint(WorkflowEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @extend_schema(
        request=None,
        parameters=[
            RUN_ID,
            OpenApiParameter(
                "activity", str, description="Set to 1 to include public node activity."
            ),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request: Request, organization: Organization, run_id: str) -> Response:
        """Retrieve the workflow status, node checkpoints, output, and reported usage."""
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

    @extend_schema(
        parameters=[RUN_ID], request=WorkflowCommandRequest, responses={200: OpenApiTypes.OBJECT}
    )
    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        """Send a command to a workflow run owned by the current user."""
        return forward_workflow_request(
            "POST", f"/runs/{UUID(str(run_id))}/commands", operation="commands", data=request.data
        )
