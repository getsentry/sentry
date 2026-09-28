from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.models import DetectorWorkflow, Workflow


class WorkflowProjectScopeResponse(TypedDict):
    projectIds: list[str]
    includesAllProjects: bool


@cell_silo_endpoint
@extend_schema(tags=["Monitors"])
class OrganizationWorkflowProjectScopeEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ALERTS_MONITORS

    @extend_schema(
        operation_id="getOrganizationWorkflowProjectScope",
        summary="Get a list of projects which are associated with an Alert through its connected Monitors.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "WorkflowProjectScopeResponse", WorkflowProjectScopeResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, workflow: Workflow
    ) -> Response[WorkflowProjectScopeResponse]:
        project_ids = list(
            DetectorWorkflow.objects.filter(workflow=workflow)
            .order_by("detector__project_id")
            .values_list("detector__project_id", flat=True)
            .distinct()
        )
        includes_all_projects = None in project_ids
        response: WorkflowProjectScopeResponse = {
            "projectIds": (
                [] if includes_all_projects else [str(project_id) for project_id in project_ids]
            ),
            "includesAllProjects": includes_all_projects,
        }
        return Response(response)
