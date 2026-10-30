from __future__ import annotations

from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.agent import interrupt_run, synchronize_execution
from sentry.investigations.endpoints.base import OrganizationInvestigationBlockEndpoint
from sentry.investigations.endpoints.serializers.responses import (
    InvestigationExecutionDetailsResponse,
)
from sentry.investigations.endpoints.validators import BlockExecutionResumeValidator
from sentry.investigations.services import (
    mark_block_execution_cancelled,
    mark_block_execution_resumed,
    mark_block_execution_stopping,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import (
    Notebook,
    NotebookBlock,
    NotebookBlockExecution,
    NotebookBlockKind,
)
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import AgentUpdateRequest, make_agent_update_request


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecutionDetailsEndpoint(
    OrganizationInvestigationBlockEndpoint
):
    owner = ApiOwner.ML_AI
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PATCH": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _execution(self, block: NotebookBlock, execution_id: str) -> NotebookBlockExecution:
        try:
            return NotebookBlockExecution.objects.select_related("seer_run").get(
                id=execution_id, block=block
            )
        except (NotebookBlockExecution.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

    @extend_schema(
        operation_id="Retrieve an Investigation Block Execution",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
            InvestigationParams.EXECUTION_ID,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "RetrieveanInvestigationBlockExecutionResponse",
                InvestigationExecutionDetailsResponse,
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Notebook,
        block: NotebookBlock,
        execution_id: str,
    ) -> Response:
        """
        Synchronize with the agent and return execution status, transcript blocks, truncation
        flag, pending user input, partial Markdown for text blocks, and any error. Pending input
        and transcript entries retain their Seer-owned shape. Requires the
        organizations:investigations feature and open organization membership.
        """
        execution = self._execution(block, execution_id)
        pending = None
        partial_markdown = None
        if execution.seer_run and execution.seer_run.seer_run_state_id:
            state = SeerAgentClient(organization, request.user).get_run(
                execution.seer_run.seer_run_state_id
            )
            synchronize_execution(execution, state)
            execution.refresh_from_db()
            pending = state.pending_user_input.dict() if state.pending_user_input else None
            if block.kind == NotebookBlockKind.TEXT:
                partial_markdown = next(
                    (
                        state_block.message.content
                        for state_block in reversed(state.blocks)
                        if state_block.message.role == "assistant" and state_block.message.content
                    ),
                    None,
                )
        response_data: InvestigationExecutionDetailsResponse = {
            "id": str(execution.id),
            "status": execution.status,
            "blocks": execution.transcript,
            "transcriptTruncated": execution.transcript_truncated,
            "pendingUserInput": pending,
            "partialMarkdown": partial_markdown,
            "error": execution.error,
        }
        return Response(response_data)

    @extend_schema(
        operation_id="Resume an Investigation Block Execution",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
            InvestigationParams.EXECUTION_ID,
        ],
        request=BlockExecutionResumeValidator,
        responses={
            202: constants.RESPONSE_ACCEPTED,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
            502: OpenApiResponse(description="Unable to resume the agent run."),
        },
        examples=[
            OpenApiExample(
                "Example request",
                value={"inputId": "input-1", "responseData": "Use the production environment"},
                request_only=True,
            )
        ],
    )
    def patch(
        self,
        request: Request,
        organization: Organization,
        investigation: Notebook,
        block: NotebookBlock,
        execution_id: str,
    ) -> Response:
        """
        Answer pending user input using inputId from execution polling. responseData may be any
        JSON value, including null. Returns 202 without a body; poll for progress. Returns 409
        before the run starts, or 502 if the agent rejects the resume request. Requires the
        organizations:investigations feature and open organization membership.
        """
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            return Response({"detail": "The run has not started."}, status=status.HTTP_409_CONFLICT)
        validator = BlockExecutionResumeValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)
        response = make_agent_update_request(
            AgentUpdateRequest(
                run_id=execution.seer_run.seer_run_state_id,
                organization_id=organization.id,
                payload={
                    "type": "user_input_response",
                    "input_id": validator.validated_data["input_id"],
                    "response_data": validator.validated_data["response_data"],
                },
            )
        )
        if response.status >= 400:
            return Response(
                {"detail": "Unable to resume the run."}, status=status.HTTP_502_BAD_GATEWAY
            )
        mark_block_execution_resumed(execution)
        return Response(status=status.HTTP_202_ACCEPTED)

    @extend_schema(
        operation_id="Stop an Investigation Block Execution",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            InvestigationParams.INVESTIGATION_ID,
            InvestigationParams.BLOCK_ID,
            InvestigationParams.EXECUTION_ID,
        ],
        request=None,
        responses={
            202: constants.RESPONSE_ACCEPTED,
            204: constants.RESPONSE_NO_CONTENT,
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
            409: constants.RESPONSE_CONFLICT,
        },
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Notebook,
        block: NotebookBlock,
        execution_id: str,
    ) -> Response:
        """
        Cancel a queued execution immediately (204), or interrupt a started agent run and mark
        the execution cancelled (202). Both responses have no body. Requires the
        organizations:investigations feature and open organization membership.
        """
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            mark_block_execution_cancelled(execution)
            return Response(status=status.HTTP_204_NO_CONTENT)
        mark_block_execution_stopping(execution)
        try:
            interrupt_run(organization, execution.seer_run.seer_run_state_id)
        finally:
            mark_block_execution_cancelled(execution)
        return Response(status=status.HTTP_202_ACCEPTED)
