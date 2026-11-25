from typing import Any
from uuid import UUID

from django.db import router, transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.investigations.models import WorkflowRun
from sentry.investigations.services.orchestration import rebuild_orchestration_source
from sentry.investigations.services.workflow_client import forward_workflow_request
from sentry.investigations.services.workflow_runtime import public_snapshot
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationNotebooksBaseEndpoint, user_id
from sentry.notebooks.models import NotebookSourceType, NotebookWorkflowRun

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
    requestId = serializers.UUIDField(
        required=False, help_text="Stable ID for retrying this command."
    )
    nodeId = serializers.UUIDField(required=False, help_text="ID of the node awaiting input.")
    inputId = serializers.CharField(required=False, help_text="ID of the pending input request.")
    answers = serializers.ListField(
        child=serializers.CharField(max_length=4000),
        max_length=4,
        required=False,
        help_text="Answers in question order.",
    )
    note = serializers.CharField(max_length=2000, required=False)
    command = serializers.ChoiceField(
        choices=["cancel", "provide_input", "steer", "retry", "recheck"],
        help_text="The command to deliver.",
    )


@extend_schema(tags=["Investigations"], parameters=[GlobalParams.ORG_ID_OR_SLUG])
class WorkflowEndpoint(OrganizationNotebooksBaseEndpoint):
    requires_user = True

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(
            "organizations:investigations-v2", kwargs["organization"], actor=request.user
        ):
            raise ResourceDoesNotExist
        return args, kwargs


@cell_silo_endpoint
class OrganizationWorkflowRunsEndpoint(WorkflowEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        request=StartWorkflowRequest,
        responses={200: OpenApiTypes.OBJECT, 400: constants.RESPONSE_BAD_REQUEST},
    )
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
        parameters=[RUN_ID],
        request=WorkflowCommandRequest,
        responses={200: OpenApiTypes.OBJECT, 409: constants.RESPONSE_CONFLICT},
    )
    def post(self, request: Request, organization: Organization, run_id: str) -> Response:
        """Send a command to a workflow run owned by the current user."""
        validator = WorkflowCommandRequest(data=request.data)
        validator.is_valid(raise_exception=True)
        payload = dict(validator.data)
        if payload["command"] == "recheck":
            owned = WorkflowRun.objects.filter(
                organization=organization,
                uuid=run_id,
                user_id=user_id(request),
                definition__name="breached_metrics",
            )
            binding = (
                NotebookWorkflowRun.objects.select_related("notebook")
                .filter(
                    organization=organization,
                    run_id__in=owned.values("uuid"),
                    notebook__source_type=NotebookSourceType.METRIC_OPEN_PERIOD,
                )
                .get_or_none()
            )
            if binding:
                source = rebuild_orchestration_source(binding.notebook)
                if source is None:
                    return Response({"detail": "The source monitor is unavailable."}, status=409)
                payload["source"] = source
        return forward_workflow_request(
            "POST", f"/runs/{UUID(str(run_id))}/commands", operation="commands", data=payload
        )
