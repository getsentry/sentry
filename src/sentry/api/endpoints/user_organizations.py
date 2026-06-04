from __future__ import annotations

from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import OrganizationSummarySerializerResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CursorQueryParam
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.users.api.bases.user import RegionSiloUserEndpoint
from sentry.users.services.user import RpcUser


# TODO(cells): Non-routable by Synapse (no org slug in URL). Fix by moving to
# @control_silo_endpoint and querying OrganizationMemberMapping + OrganizationMapping.
@extend_schema(tags=["Users"])
@cell_silo_endpoint
class UserOrganizationsEndpoint(RegionSiloUserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List a User's Organizations",
        parameters=[
            OpenApiParameter(
                name="user_id",
                location="path",
                required=True,
                type=str,
                description="The ID of the user, or `me` for the current user.",
            ),
            OpenApiParameter(
                name="query",
                location="query",
                required=False,
                type=str,
                description="Limit results to organizations whose name or slug contains this value.",
            ),
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListUserOrganizations", list[OrganizationSummarySerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, user: RpcUser
    ) -> Response[list[OrganizationSummarySerializerResponse]]:
        """
        Return a list of organizations that the given user is a member of.
        """
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
