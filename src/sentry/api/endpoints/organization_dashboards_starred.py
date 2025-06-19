from django.db import IntegrityError, router, transaction
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.dashboard import DashboardListSerializer
from sentry.api.serializers.rest_framework.dashboard import DashboardStarredOrderSerializer
from sentry.models.dashboard import DashboardFavoriteUser
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write"],
        "PUT": ["member:read", "member:write"],
    }


@region_silo_endpoint
class OrganizationDashboardsStarredEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.PERFORMANCE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:dashboards-starred-reordering", organization, actor=request.user
        )

    def get(self, request: Request, organization: Organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        favorites = DashboardFavoriteUser.objects.get_favorite_dashboards(
            organization=organization, user_id=request.user.id
        ).select_related("dashboard")

        def data_fn(offset, limit):
            return [favorite.dashboard for favorite in favorites[offset : offset + limit]]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda x: serialize(x, request.user, serializer=DashboardListSerializer()),
            default_per_page=25,
        )


@region_silo_endpoint
class OrganizationDashboardsStarredOrderEndpoint(OrganizationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.PERFORMANCE
    permission_classes = (MemberPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:dashboards-starred-reordering", organization, actor=request.user
        )

    def put(self, request: Request, organization: Organization) -> Response:
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = DashboardStarredOrderSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        dashboard_ids = serializer.validated_data["dashboard_ids"]

        try:
            with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
                DashboardFavoriteUser.objects.reorder_favorite_dashboards(
                    organization=organization,
                    user_id=request.user.id,
                    new_dashboard_positions=dashboard_ids,
                )
        except (IntegrityError, ValueError):
            raise ParseError("Mismatch between existing and provided starred dashboards.")

        return Response(status=status.HTTP_204_NO_CONTENT)
