from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.base import OrganizationInboxEndpoint
from sentry.inbox.filters import UNREAD_ITEMS
from sentry.inbox.response_types import InboxUnreadCountResponse
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.utils.auth import AuthenticatedHttpRequest


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationInboxUnreadCountEndpoint(OrganizationInboxEndpoint):
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    @extend_schema(
        operation_id="Count Personal Unread Inbox Items",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer("InboxUnreadCount", InboxUnreadCountResponse),
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: AuthenticatedHttpRequest, organization: Organization
    ) -> Response[InboxUnreadCountResponse]:
        """Count your active unread inbox items."""
        user = request.user
        count = InboxItem.objects.filter(
            UNREAD_ITEMS,
            organization=organization,
            user_id=user.id,
            status=ObjectStatus.ACTIVE,
        ).count()
        return Response({"count": count})
