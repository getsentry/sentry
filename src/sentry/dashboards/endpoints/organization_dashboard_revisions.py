from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.dashboards.endpoints.organization_dashboard_details import OrganizationDashboardBase
from sentry.models.dashboard import Dashboard, DashboardRevision
from sentry.models.organization import Organization
from sentry.users.services.user.service import user_service

REVISIONS_FEATURE = "organizations:dashboards-revisions"


class DashboardRevisionSerializer(Serializer):
    def get_attrs(
        self, item_list: Sequence[DashboardRevision], user: Any, **kwargs: Any
    ) -> dict[DashboardRevision, dict[str, Any]]:
        serialized_users = {
            u["id"]: {"id": u["id"], "name": u["name"], "email": u["email"]}
            for u in user_service.serialize_many(
                filter={
                    "user_ids": [
                        rev.created_by_id for rev in item_list if rev.created_by_id is not None
                    ]
                },
                as_user=user,
            )
        }
        return {
            rev: {"created_by": serialized_users.get(str(rev.created_by_id))} for rev in item_list
        }

    def serialize(
        self, obj: DashboardRevision, attrs: dict[str, Any], user: Any, **kwargs: Any
    ) -> dict[str, Any]:
        return {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "source": obj.source,
        }


@cell_silo_endpoint
class OrganizationDashboardRevisionsEndpoint(OrganizationDashboardBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DASHBOARDS
    permission_classes = (OrganizationPermission,)

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
            on_results=lambda results: serialize(
                results, request.user, serializer=DashboardRevisionSerializer()
            ),
        )
