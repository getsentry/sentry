from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.dashboards.endpoints.organization_dashboard_details import (
    REVISIONS_FEATURE,
    OrganizationDashboardBase,
)
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization
from sentry.users.services.user.service import user_service


def _serialize_revisions(revisions: list[DashboardRevision], user: Any) -> list[dict[str, Any]]:
    user_ids = [r.created_by_id for r in revisions if r.created_by_id is not None]
    users_by_id = {
        u["id"]: {"id": u["id"], "name": u["name"], "email": u["email"]}
        for u in user_service.serialize_many(filter={"user_ids": user_ids}, as_user=user)
    }
    return [
        {
            "id": str(r.id),
            "title": r.title,
            "dateCreated": r.date_added,
            "createdBy": users_by_id.get(str(r.created_by_id)),
            "source": r.source,
        }
        for r in revisions
    ]


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
            on_results=lambda results: _serialize_revisions(results, request.user),
        )
