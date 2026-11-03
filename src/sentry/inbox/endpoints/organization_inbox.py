from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.base import PAGINATION_PARAMETERS, OrganizationInboxEndpoint
from sentry.inbox.filters import InboxFilterSerializer, filter_inbox_items
from sentry.inbox.paginator import InboxPaginator
from sentry.inbox.response_types import InboxItemResponse
from sentry.inbox.serializers import InboxItemSerializer
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.cursors import StringCursor


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationInboxIndexEndpoint(OrganizationInboxEndpoint):
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    @extend_schema(
        operation_id="List Personal Inbox Items",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            *PAGINATION_PARAMETERS,
            InboxFilterSerializer,
        ],
        responses={
            200: inline_sentry_response_serializer("InboxItems", list[InboxItemResponse]),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: AuthenticatedHttpRequest, organization: Organization
    ) -> Response[list[InboxItemResponse]]:
        """List your active inbox items, newest activity first."""
        filters = InboxFilterSerializer(data=request.GET)
        if not filters.is_valid():
            raise ParseError({"detail": filters.errors})
        user = request.user
        items: QuerySet[InboxItem] = InboxItem.objects.filter(
            organization=organization, user_id=user.id, status=ObjectStatus.ACTIVE
        )
        items = filter_inbox_items(items, filters.validated_data).select_related("organization")
        return self.paginate(
            request,
            queryset=items,
            order_by="-last_activity_at",
            paginator_cls=InboxPaginator,
            cursor_cls=StringCursor,
            default_per_page=25,
            max_per_page=100,
            on_results=lambda page: serialize(page, user, InboxItemSerializer()),
        )
