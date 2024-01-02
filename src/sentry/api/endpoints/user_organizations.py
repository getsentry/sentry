from __future__ import annotations

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.user import RegionSiloUserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.user import RpcUser


@region_silo_endpoint
class UserOrganizationsEndpoint(RegionSiloUserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, user: RpcUser) -> Response:
        queryset = Organization.objects.get_for_user_ids({user.id})

        query = request.GET.get("query")
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(slug__icontains=query))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
