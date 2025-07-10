from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers import (
    WorkflowGroupHistorySerializer,
    fetch_workflow_groups_paginated,
)
from sentry.workflow_engine.models import Workflow


@region_silo_endpoint
class OrganizationWorkflowGroupHistoryEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Retrieve Group Firing History for a Workflow",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
        ],
        responses={
            200: WorkflowGroupHistorySerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        per_page = self.get_per_page(request)
        cursor = self.get_cursor_from_request(request)
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams:
            raise ParseError(detail="Invalid start and end dates")

        results = fetch_workflow_groups_paginated(workflow, start, end, cursor, per_page)

        response = Response(
            serialize(results.results, request.user, WorkflowGroupHistorySerializer())
        )
        self.add_cursor_headers(request, response, results)
        return response
