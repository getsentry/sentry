from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.agent import interrupt_run, synchronize_execution
from sentry.investigations.endpoints.base import OrganizationInvestigationBlockEndpoint
from sentry.investigations.endpoints.validators import BlockExecutionResumeValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockKind,
)
from sentry.investigations.services import (
    mark_block_execution_cancelled,
    mark_block_execution_resumed,
    mark_block_execution_stopping,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import AgentUpdateRequest, make_agent_update_request


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecutionDetailsEndpoint(
    OrganizationInvestigationBlockEndpoint
):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PATCH": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _execution(
        self, block: InvestigationBlock, execution_id: str
    ) -> InvestigationBlockExecution:
        try:
            return InvestigationBlockExecution.objects.select_related("seer_run").get(
                id=execution_id, block=block
            )
        except (InvestigationBlockExecution.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
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
            if block.kind == InvestigationBlockKind.TEXT:
                partial_markdown = next(
                    (
                        state_block.message.content
                        for state_block in reversed(state.blocks)
                        if state_block.message.role == "assistant" and state_block.message.content
                    ),
                    None,
                )
        return Response(
            {
                "id": str(execution.id),
                "status": execution.status,
                "blocks": execution.transcript,
                "transcriptTruncated": execution.transcript_truncated,
                "pendingUserInput": pending,
                "partialMarkdown": partial_markdown,
                "error": execution.error,
            }
        )

    def patch(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
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

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
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
