from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import DashboardRevisionResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import (
    CursorQueryParam,
    DashboardParams,
    GlobalParams,
    VisibilityParams,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.dashboards.endpoints.organization_dashboard_details import (
    OrganizationDashboardBase,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardRevisionsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.DASHBOARDS

    @extend_schema(
        operation_id="listOrganizationDashboardRevisions",
        summary="List a Custom Dashboard's Revisions",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DashboardParams.DASHBOARD_ID,
            VisibilityParams.PER_PAGE,
            CursorQueryParam,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "DashboardRevisionListResponse", list[DashboardRevisionResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DashboardExamples.DASHBOARD_REVISIONS_RESPONSE,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[str, Any],
    ) -> Response[list[DashboardRevisionResponse]] | Response[None]:
        """
        Return the revision history of an organization's custom dashboard, newest first.

        Each edit or restore of the dashboard records a revision holding the dashboard as it
        was just before the change. Only the 10 most recent revisions are kept. Pass a
        revision's `id` to the restore endpoint to roll the dashboard back to it.
        """
        if not isinstance(dashboard, Dashboard):
            return Response(status=404)

        queryset = DashboardRevision.objects.filter(dashboard=dashboard).order_by("-date_added")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
