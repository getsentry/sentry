from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.status_pages.endpoints.serializers.status_page import (
    StatusPageResponseSerializer,
    StatusPageSerializer,
)
from sentry.status_pages.models.status_page import StatusPage


@extend_schema(tags=["Status Pages"])
@region_silo_endpoint
class OrganizationStatusPagesEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="List an Organization's Status Pages",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListStatusPagesResponse", list[StatusPageResponseSerializer]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization) -> Response:
        """
        List all status pages for an organization.
        """
        queryset = StatusPage.objects.filter(organization=organization).order_by("-date_added")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, StatusPageResponseSerializer()),
        )

    @extend_schema(
        operation_id="Create a Status Page",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=StatusPageSerializer,
        responses={
            201: StatusPageResponseSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new status page for an organization.
        """
        serializer = StatusPageSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        status_page = StatusPage.objects.create(
            organization=organization,
            title=data["title"],
            description=data.get("description"),
            is_public=data.get("is_public", False),
            is_accepting_subscribers=data.get("is_accepting_subscribers", False),
            cname=data.get("cname"),
        )

        return Response(
            serialize(status_page, request.user, StatusPageResponseSerializer()),
            status=201,
        )
