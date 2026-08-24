from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.agent import start_execution_run
from sentry.investigations.endpoints.base import (
    OrganizationInvestigationBlockEndpoint,
    require_authenticated_user,
    service_error,
)
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
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    def post(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
        block: InvestigationBlock,
    ) -> Response:
        actor_id = require_authenticated_user(request)
        validator = BlockExecutionStartValidator(data=request.data)
        if not validator.is_valid():
            return Response(validator.errors, status=status.HTTP_400_BAD_REQUEST)

        project_ids_for_user = request.access.accessible_project_ids
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
                expected_investigation_version=validator.validated_data["investigation_version"],
                expected_block_version=validator.validated_data["version"],
                user_id=actor_id,
                project_ids=project_ids,
                accessible_project_ids=project_ids_for_user,
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
                mark_block_execution_dispatch_failed(execution)
                metrics.incr(f"{metric_namespace}.dispatch_failed")
                raise

        execution = InvestigationBlockExecution.objects.get(id=execution.id)
        return Response(
            {"id": str(execution.id), "status": execution.status},
            status=status.HTTP_202_ACCEPTED,
        )
