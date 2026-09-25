from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.endpoints.timeseries import StatsResponse
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers.timeseries_value_serializer import (
    fetch_workflow_hourly_stats,
    serialize_workflow_stats,
)
from sentry.workflow_engine.models import Workflow


@cell_silo_endpoint
class OrganizationWorkflowStatsEndpoint(OrganizationWorkflowEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Retrieve Firing Stats for a Workflow for a Given Time Range.",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            WorkflowParams.WORKFLOW_ID,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
        ],
        responses={
            200: inline_sentry_response_serializer("WorkflowStats", StatsResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, workflow: Workflow
    ) -> Response[StatsResponse]:
        """
        Note that results are returned in hourly buckets.
        """
        try:
            start, end = get_date_range_from_params(request.GET)
        except InvalidParams:
            raise ParseError(detail="Invalid date range")
        results = fetch_workflow_hourly_stats(workflow, start, end)
        return Response(serialize_workflow_stats(results, start, end))
