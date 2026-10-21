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
from sentry.investigations.agent import (
    cancel_investigation_executions_after_failure,
    start_execution_run,
)
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationBlockEndpoint,
    organization_project_ids,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.serializers.responses import InvestigationExecutionResponse
from sentry.investigations.endpoints.validators import BlockExecutionStartValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockKind,
)
from sentry.investigations.services import (
    create_block_execution,
    mark_block_execution_dispatch_failed,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.utils import metrics


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecutionsEndpoint(OrganizationInvestigationBlockEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Execute an Investigation Block",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
        ],
        request=BlockExecutionStartValidator,
        responses={
            202: inline_sentry_response_serializer(
                "InvestigationExecutionResponse", InvestigationExecutionResponse
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
                    "investigationVersion": 2,
                    "version": 1,
                    "requestId": "00000000-0000-4000-8000-000000000001",
                },
                request_only=True,
            )
        ],
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        """
        Start asynchronous text generation or query execution. Send notebook and block versions
        and optionally an idempotency requestId. Returns execution ID and status, not the
        completed output. Poll execution details for progress and notebook details for output.
        Requires an authenticated user and access to the selected projects. Requires the
        organizations:investigations feature and open organization membership.
        """
        actor_id = require_authenticated_user(request)
        validator = BlockExecutionStartValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        org_project_ids = organization_project_ids(organization)
        selected_project_ids = set(
            investigation.projects.order_by("id").values_list("id", flat=True)
        )
        if selected_project_ids:
            if not selected_project_ids.issubset(org_project_ids):
                return Response(
                    {"detail": "One or more investigation projects are inaccessible."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            project_ids = sorted(selected_project_ids)
        elif block.kind == InvestigationBlockKind.QUERY:
            project_ids = sorted(org_project_ids)
        else:
            project_ids = []

        client = SeerAgentClient(organization, request.user)
        try:
            execution, created = create_block_execution(
                block=block,
                expected_investigation_version=validator.validated_data["investigation_version"],
                expected_block_version=validator.validated_data["version"],
                user_id=actor_id,
                project_ids=project_ids,
                accessible_project_ids=org_project_ids,
                request_id=validator.validated_data.get("request_id"),
            )
        except Exception as execution_error:
            response = service_error(execution_error)
            if response is not None:
                return response
            raise

        if created:
            metric_namespace = (
                "investigations.query_execution"
                if block.kind == InvestigationBlockKind.QUERY
                else "investigations.text_execution"
            )
            try:
                start_execution_run(execution, organization, request.user, client=client)
                metrics.incr(
                    f"{metric_namespace}.started",
                    tags={"executor": execution.executor},
                )
            except Exception:
                if mark_block_execution_dispatch_failed(execution):
                    cancel_investigation_executions_after_failure(execution)
                metrics.incr(f"{metric_namespace}.dispatch_failed")
                raise

        execution = InvestigationBlockExecution.objects.get(id=execution.id)
        response_data: InvestigationExecutionResponse = {
            "id": str(execution.id),
            "status": execution.status,
        }
        return Response(
            response_data,
            status=status.HTTP_202_ACCEPTED,
        )
