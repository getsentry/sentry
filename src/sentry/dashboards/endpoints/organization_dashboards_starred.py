import sentry_sdk
from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.dashboard import DashboardListResponse, DashboardListSerializer
from sentry.api.serializers.rest_framework.dashboard import DashboardStarredOrderSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.dashboard_examples import DashboardExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, VisibilityParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import require_user
from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.organization import Organization


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "dashboard:read", "user_preference:read"],
        "PUT": ["member:read", "member:write", "dashboard:write", "user_preference:write"],
    }

    # user_preference:read and user_preference:write replace member:read in orgs with granular scopes.
    rejects_deprecated_scopes = True


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardsStarredEndpoint(OrganizationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.DASHBOARDS
    permission_classes = (MemberPermission,)

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has("organizations:dashboards-starred", organization, actor=request.user)

    @extend_schema(
        operation_id="listOrganizationStarredDashboards",
        summary="List an Organization's Starred Custom Dashboards",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, VisibilityParams.PER_PAGE, CursorQueryParam],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "StarredDashboardListResponse", list[DashboardListResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=DashboardExamples.DASHBOARDS_QUERY_RESPONSE,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[DashboardListResponse]] | Response[None]:
        """
        Return the custom dashboards the requesting user has starred, in the user's starred
        order. Returns 400 if the request is not made on behalf of a user.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        user_id = require_user(request).id
        favorites = DashboardFavoriteUser.objects.get_favorite_dashboards(
            organization=organization, user_id=user_id
        ).select_related("dashboard")

        if favorites.filter(position__isnull=True).exists():
            # Commit the order of the dashboards of this current response if there are any
            # that don't have a position assigned
            DashboardFavoriteUser.objects.reorder_favorite_dashboards(
                organization=organization,
                user_id=user_id,
                new_dashboard_positions=[favorite.dashboard.id for favorite in favorites],
            )

        def data_fn(offset: int, limit: int) -> list[Dashboard]:
            return [favorite.dashboard for favorite in favorites[offset : offset + limit]]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=DashboardListSerializer(),
                context={"organization": organization},
            ),
            default_per_page=25,
        )


@extend_schema(tags=["Dashboards"])
@cell_silo_endpoint
class OrganizationDashboardsStarredOrderEndpoint(OrganizationEndpoint):
    publish_status = {"PUT": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.DASHBOARDS
    permission_classes = (MemberPermission,)

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has("organizations:dashboards-starred", organization, actor=request.user)

    @extend_schema(
        operation_id="reorderOrganizationStarredDashboards",
        summary="Reorder an Organization's Starred Custom Dashboards",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=DashboardStarredOrderSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, organization: Organization
    ) -> Response[None] | Response[ValidationErrorResponse]:
        """
        Reorder the custom dashboards the requesting user has starred. If the payload lists
        only some of the starred dashboards, only those dashboards swap positions among
        themselves. Returns 400 if the payload names a dashboard the user hasn't starred or
        repeats one, or if the request is not made on behalf of a user.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = DashboardStarredOrderSerializer(
            data=request.data, context={"organization": organization, "user": request.user}
        )

        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

        dashboard_ids = serializer.validated_data["dashboard_ids"]

        try:
            with transaction.atomic(using=router.db_for_write(DashboardFavoriteUser)):
                DashboardFavoriteUser.objects.reorder_favorite_dashboards(
                    organization=organization,
                    user_id=require_user(request).id,
                    new_dashboard_positions=dashboard_ids,
                )
        except (IntegrityError, ValueError) as e:
            sentry_sdk.capture_exception(e)
            raise ParseError("Mismatch between existing and provided starred dashboards.")

        return Response(status=status.HTTP_204_NO_CONTENT)
