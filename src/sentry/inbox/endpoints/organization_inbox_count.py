from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.examples.inbox_examples import InboxExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.base import OrganizationInboxEndpoint
from sentry.inbox.filters import InboxFilterSerializer, filter_inbox_items
from sentry.inbox.response_types import InboxCountResponse
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.utils.auth import AuthenticatedHttpRequest


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationInboxCountEndpoint(OrganizationInboxEndpoint):
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    @extend_schema(
        operation_id="Count Personal Inbox Items",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InboxFilterSerializer],
        responses={
            200: inline_sentry_response_serializer("InboxCount", InboxCountResponse),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
        examples=InboxExamples.COUNT_ITEMS,
    )
    def get(
        self, request: AuthenticatedHttpRequest, organization: Organization
    ) -> Response[InboxCountResponse]:
        """Return the number of inbox items matching the filters for the authenticated user."""
        filters = InboxFilterSerializer(data=request.GET)
        if not filters.is_valid():
            raise ParseError({"detail": filters.errors})
        user = request.user
        items = InboxItem.objects.filter(
            organization=organization,
            user_id=user.id,
            status=ObjectStatus.ACTIVE,
        )
        count = filter_inbox_items(items, filters.validated_data).count()
        return Response({"count": count})
