from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.agent import (
    interrupt_run,
    start_execution_run,
    synchronize_execution,
    synchronize_title,
)
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationBlockEndpoint,
    OrganizationInvestigationEndpoint,
    accessible_project_ids,
    query_execution_enabled,
    require_authenticated_user,
    service_error,
)
from sentry.investigations.endpoints.validators import BlockExecutionStartValidator
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
)
from sentry.investigations.services import (
    create_block_execution,
    mark_block_execution_dispatch_failed,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_utils import AgentUpdateRequest, make_agent_update_request
from sentry.utils import metrics


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecuteEndpoint(OrganizationInvestigationBlockEndpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        actor_id = require_authenticated_user(request)
        if not query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        serializer = BlockExecutionStartValidator(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids_for_user = accessible_project_ids(self, request, organization)
        selected_project_ids = set(
            investigation.projects.order_by("id").values_list("id", flat=True)
        )
        if selected_project_ids:
            if not selected_project_ids.issubset(project_ids_for_user):
                return Response(
                    {"detail": "One or more investigation projects are inaccessible."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            project_ids = sorted(selected_project_ids)
        elif block.kind == InvestigationBlockKind.QUERY:
            project_ids = sorted(project_ids_for_user)
        else:
            project_ids = []

        client = SeerAgentClient(organization, request.user)
        try:
            execution, created = create_block_execution(
                block=block,
                expected_investigation_version=serializer.validated_data["investigation_version"],
                expected_block_version=serializer.validated_data["version"],
                user_id=actor_id,
                project_ids=project_ids,
                accessible_project_ids=project_ids_for_user,
                request_id=serializer.validated_data.get("request_id"),
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
                mark_block_execution_dispatch_failed(execution)
                metrics.incr(f"{metric_namespace}.dispatch_failed")
                raise

        execution = InvestigationBlockExecution.objects.get(id=execution.id)
        return Response(
            {"id": str(execution.id), "status": execution.status},
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationBlockExecutionEndpoint(OrganizationInvestigationBlockEndpoint):
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
        if not query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
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
        if not query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            return Response({"detail": "The run has not started."}, status=409)
        input_id = request.data.get("inputId")
        if not input_id or "responseData" not in request.data:
            return Response({"detail": "inputId and responseData are required."}, status=400)
        response = make_agent_update_request(
            AgentUpdateRequest(
                run_id=execution.seer_run.seer_run_state_id,
                organization_id=organization.id,
                payload={
                    "type": "user_input_response",
                    "input_id": input_id,
                    "response_data": request.data["responseData"],
                },
            )
        )
        if response.status >= 400:
            return Response({"detail": "Unable to resume the run."}, status=502)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.RUNNING
        )
        return Response(status=202)

    def delete(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
        execution_id: str,
    ) -> Response:
        if not query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        execution = self._execution(block, execution_id)
        if not execution.seer_run or not execution.seer_run.seer_run_state_id:
            return Response(status=204)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.STOPPING
        )
        interrupt_run(organization, execution.seer_run.seer_run_state_id)
        InvestigationBlockExecution.objects.filter(id=execution.id).update(
            status=InvestigationBlockExecutionStatus.CANCELLED,
            completed_at=timezone.now(),
        )
        return Response(status=202)


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationTitleGenerationEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
    ) -> Response:
        if not query_execution_enabled(request, organization):
            raise ResourceDoesNotExist
        preview = None
        if investigation.title_seer_run and investigation.title_seer_run.seer_run_state_id:
            state = SeerAgentClient(organization, request.user).get_run(
                investigation.title_seer_run.seer_run_state_id
            )
            synchronize_title(investigation, state)
            investigation.refresh_from_db()
            preview = next(
                (
                    state_block.message.content
                    for state_block in reversed(state.blocks)
                    if state_block.message.role == "assistant" and state_block.message.content
                ),
                None,
            )
        return Response({"status": investigation.title_generation_status, "preview": preview})
