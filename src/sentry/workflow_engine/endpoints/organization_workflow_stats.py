from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, WorkflowParams
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowEndpoint,
)
from sentry.workflow_engine.endpoints.serializers import (
    TimeSeriesValueSerializer,
    fetch_workflow_hourly_stats,
)
from sentry.workflow_engine.models import Workflow


@region_silo_endpoint
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
        ],
        responses={
            200: TimeSeriesValueSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, workflow: Workflow) -> Response:
        """
        Note that results are returned in hourly buckets.
        """
        start, end = get_date_range_from_params(request.GET)
        results = fetch_workflow_hourly_stats(workflow, start, end)
        return Response(serialize(results, request.user, TimeSeriesValueSerializer()))
