from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.dashboards.endpoints.organization_dashboard_details import (
    REVISIONS_FEATURE,
    OrganizationDashboardBase,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization


@cell_silo_endpoint
class OrganizationDashboardRevisionDetailsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: str | int,
        dashboard_id: str | int,
        revision_id: str | int,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, dashboard_id, *args, **kwargs
        )
        dashboard = kwargs.get("dashboard")
        if not isinstance(dashboard, Dashboard):
            raise ResourceDoesNotExist

        try:
            kwargs["revision"] = DashboardRevision.objects.get(
                id=revision_id,
                dashboard=dashboard,
            )
        except (DashboardRevision.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        return args, kwargs

    def get(
        self,
        request: Request,
        organization: Organization,
        dashboard: Dashboard,
        revision: DashboardRevision,
    ) -> Response:
        """
        Return the dashboard snapshot for a specific revision.
        """
        if not features.has(REVISIONS_FEATURE, organization, actor=request.user):
            return Response(status=404)

        if revision.snapshot_schema_version != DashboardRevision.SNAPSHOT_SCHEMA_VERSION:
            return Response(
                {"detail": "This revision requires migration before it can be previewed."},
                status=422,
            )

        return self.respond(revision.snapshot)
