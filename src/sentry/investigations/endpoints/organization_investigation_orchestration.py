from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationCommandResponse,
    InvestigationOrchestrationResponse,
)
from sentry.investigations.endpoints.validators import (
    InvestigationOrchestrationCommandValidator,
)
from sentry.investigations.models import Investigation
from sentry.investigations.services.investigations import InvestigationServiceError
from sentry.investigations.services.orchestration import (
    accept_orchestration_command,
    get_orchestration_projection,
)
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationOrchestrationEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Retrieve Investigation Orchestration",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "RetrieveInvestigationOrchestrationResponse", InvestigationOrchestrationResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Poll the agent workflow independently of notebook details. The Seer-owned projection
        includes runId (nullable before dispatch), investigationId, workflowVersion, generation,
        phase, status, notebookRevision, broadScan, hypotheses, report, pendingInput, errors,
        heartbeatAt (nullable), updatedAt, and serverTime. Optional timing and scheduling fields
        may arrive as the workflow progresses. Returns 404 for a notebook without orchestration.
        Requires the organizations:investigations feature and open organization membership.
        """
        try:
            projection = get_orchestration_projection(investigation)
        except InvestigationServiceError as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(projection)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationOrchestrationCommandsEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Send an Investigation Command",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=InvestigationOrchestrationCommandValidator,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationCommandResponse", InvestigationCommandResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={
                    "requestId": "00000000-0000-4000-8000-000000000001",
                    "expectedWorkflowVersion": 1,
                    "command": {
                        "type": "provide_input",
                        "prompt": "Why did checkout latency increase?",
                    },
                },
                request_only=True,
            )
        ],
    )
    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """
        Submit provide_input, add_hypothesis, set_hypothesis_disposition, steer, retry, or
        cancel. Use a UUID requestId for idempotency and expectedWorkflowVersion from the
        projection, not the notebook version. Retries with the same ID and payload return
        duplicate=true; conflicting reuse or stale versions return 409. The response
        acknowledges acceptance and includes the current projection. Poll orchestration for
        completion. Requires an authenticated user. Requires the organizations:investigations
        feature and open organization membership.
        """
        actor_id = require_authenticated_user(request)
        validator = InvestigationOrchestrationCommandValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        values = validator.validated_data
        command = dict(values["command"])
        command_type = command.pop("type")
        try:
            accepted = accept_orchestration_command(
                investigation=investigation,
                request_id=values["request_id"],
                expected_workflow_version=values["expected_workflow_version"],
                command_type=command_type,
                payload=command,
                actor_id=actor_id,
            )
        except InvestigationServiceError as error:
            response = service_error(error)
            if response is not None:
                return response
            raise

        response_data: InvestigationCommandResponse = {
            "runId": (str(accepted.run_id) if accepted.run_id is not None else None),
            "requestId": str(accepted.request_id),
            "accepted": True,
            "duplicate": accepted.duplicate,
            "workflowVersion": accepted.workflow_version,
            "commandStatus": accepted.status,
            "commandError": accepted.error,
            "projection": accepted.projection,
        }
        return Response(
            response_data,
            status=status.HTTP_200_OK,
        )
