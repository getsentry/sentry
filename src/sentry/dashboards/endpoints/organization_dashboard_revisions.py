from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.dashboards.endpoints.organization_dashboard_details import (
    REVISIONS_FEATURE,
    OrganizationDashboardBase,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization


@cell_silo_endpoint
class OrganizationDashboardRevisionsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS

    def get(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard | dict[str, Any],
    ) -> Response:
        """
        Return the revision history for an organization's custom dashboard.
        """
        if not features.has(REVISIONS_FEATURE, organization, actor=request.user):
            return Response(status=404)

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
