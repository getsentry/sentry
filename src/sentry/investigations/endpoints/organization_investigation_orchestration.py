from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationEndpoint,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.validators import (
    InvestigationOrchestrationCommandValidator,
)
from sentry.investigations.models import Investigation
from sentry.investigations.services.investigations import InvestigationServiceError
from sentry.investigations.services.orchestration import (
    accept_orchestration_command,
    get_orchestration_run,
    serialize_orchestration_run,
)
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationOrchestrationEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        try:
            orchestration_run = get_orchestration_run(investigation)
        except InvestigationServiceError as error:
            response = service_error(error)
            if response is not None:
                return response
            raise
        return Response(serialize_orchestration_run(orchestration_run))


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationOrchestrationCommandsEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
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

        return Response(
            {
                "runId": (
                    str(accepted.orchestration_run.seer_run_id)
                    if accepted.orchestration_run.seer_run_id is not None
                    else None
                ),
                "requestId": str(accepted.command.request_id),
                "accepted": True,
                "duplicate": accepted.duplicate,
                "workflowVersion": accepted.orchestration_run.workflow_version,
                "projection": serialize_orchestration_run(accepted.orchestration_run),
            },
            status=status.HTTP_200_OK,
        )
