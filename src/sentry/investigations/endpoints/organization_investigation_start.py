from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.validators import InvestigationStartValidator
from sentry.investigations.models import WorkflowRun
from sentry.investigations.services import breached_metric_orchestration_source, start_investigation
from sentry.investigations.services.workflow_client import forward_workflow_request
from sentry.investigations.services.workflow_runtime import metric_workflow_request_id
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import (
    OrganizationNotebooksBaseEndpoint,
    organization_project_ids,
    request_creator_actor,
    require_authenticated_user,
    service_error,
)
from sentry.notebooks.endpoints.serializers import (
    NotebookDetailsSerializer,
    NotebookDetailsSerializerResponse,
)
from sentry.notebooks.telemetry import record_notebook_started


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationStartEndpoint(OrganizationNotebooksBaseEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Start an Investigation",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=InvestigationStartValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", NotebookDetailsSerializerResponse
            ),
            201: inline_sentry_response_serializer(
                "InvestigationDetailsResponse", NotebookDetailsSerializerResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={
                    "source": {"type": "manual", "prompt": "Investigate checkout latency"},
                    "projectIds": [1],
                },
                request_only=True,
            )
        ],
    )
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Start an agentic investigation from a source. Returns 201 for a new investigation and
        200 when a metric source reuses an active one.
        """
        require_authenticated_user(request)
        use_workflow = request.query_params.get("version") == "2"
        if use_workflow and not features.has(
            "organizations:investigations-v2", organization, actor=request.user
        ):
            raise ResourceDoesNotExist
        validator = InvestigationStartValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        values = validator.validated_data
        try:
            investigation, created = start_investigation(
                organization=organization,
                creator=lambda: request_creator_actor(request),
                title=values.get("title"),
                source=values["source"],
                project_ids=values.get("project_ids", []),
                accessible_project_ids=organization_project_ids(organization),
                filters=values.get("filters", {}),
                use_workflow=use_workflow,
            )
        except Exception as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        if created:
            record_notebook_started(investigation)
        if use_workflow:
            # The notebook owns the launch identity and snapshot, even when two viewers click.
            request_id = metric_workflow_request_id(investigation.id)
            run = WorkflowRun.objects.filter(
                organization=organization,
                request_id=request_id,
                checkpoint__notebook_id=investigation.id,
            )
            if not run.exists():
                accepted = forward_workflow_request(
                    "POST",
                    "/runs",
                    operation="runs",
                    data={
                        "workflow": "breached_metrics",
                        "requestId": str(request_id),
                        "input": {
                            **breached_metric_orchestration_source(investigation.source),
                            "notebookId": str(investigation.id),
                        },
                    },
                )
                if not run.exists():
                    if accepted.status_code >= 400:
                        return accepted
                    return Response(
                        {"detail": "The workflow did not open its notebook."}, status=502
                    )
        return Response(
            serialize(
                investigation,
                request.user,
                NotebookDetailsSerializer(access=request.access),
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
