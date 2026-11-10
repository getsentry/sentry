from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.base import PAGINATION_PARAMETERS, OrganizationInboxEndpoint
from sentry.inbox.paginator import InboxPaginator
from sentry.inbox.response_types import InboxItemEventResponse
from sentry.inbox.serializers import InboxItemEventSerializer
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.cursors import StringCursor


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationInboxItemEventsEndpoint(OrganizationInboxEndpoint):
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    @extend_schema(
        operation_id="List Personal Inbox Item Events",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter("item_id", str, location="path", required=True),
            *PAGINATION_PARAMETERS,
        ],
        responses={
            200: inline_sentry_response_serializer("InboxItemEvents", list[InboxItemEventResponse]),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: AuthenticatedHttpRequest, organization: Organization, item_id: str
    ) -> Response[list[InboxItemEventResponse]]:
        """List an inbox item's events, newest first. Reading does not change its read state."""
        user = request.user
        item = get_object_or_404(
            InboxItem,
            id=item_id,
            organization=organization,
            user_id=user.id,
            status=ObjectStatus.ACTIVE,
        )
        return self.paginate(
            request,
            queryset=item.events.select_related("inbox_item"),
            order_by="-date_added",
            paginator_cls=InboxPaginator,
            cursor_cls=StringCursor,
            default_per_page=25,
            max_per_page=100,
            on_results=lambda page: serialize(page, user, InboxItemEventSerializer()),
        )
