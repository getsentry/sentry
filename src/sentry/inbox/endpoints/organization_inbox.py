from datetime import datetime
from typing import TypedDict

from django.db.models import QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import require_user
from sentry.constants import ObjectStatus
from sentry.inbox.endpoints.base import PAGINATION_PARAMETERS, OrganizationInboxEndpoint
from sentry.inbox.filters import InboxFilterSerializer, filter_inbox_items
from sentry.inbox.paginator import InboxPaginator
from sentry.inbox.response_types import InboxItemResponse, InboxUpdateResponse
from sentry.inbox.serializers import InboxItemSerializer
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.cursors import StringCursor


class InboxUpdateRequest(TypedDict, total=False):
    isRead: bool
    isRemoved: bool


class InboxUpdate(TypedDict, total=False):
    last_read_at: datetime | None
    status: int


class InboxUpdateSerializer(serializers.Serializer[None, InboxUpdate]):
    isRead = serializers.BooleanField(required=False)
    isRemoved = serializers.BooleanField(
        required=False, help_text="Set to false to cancel a pending removal."
    )

    def validate_isRemoved(self, value: bool) -> bool:
        if value:
            raise serializers.ValidationError("Only undoing removal is supported.")
        return value

    def validate(self, attrs: InboxUpdateRequest) -> InboxUpdate:
        if not attrs:
            raise serializers.ValidationError("Provide isRead or isRemoved.")
        updates: InboxUpdate = {}
        if "isRead" in attrs:
            updates["last_read_at"] = timezone.now() if attrs["isRead"] else None
        if "isRemoved" in attrs:
            updates["status"] = ObjectStatus.ACTIVE
        return updates


class OrganizationInboxIndexPermission(OrganizationPermission):
    # Updating personal inbox state requires the same access as listing it.
    scope_map = {**OrganizationPermission.scope_map, "PUT": OrganizationPermission.scope_map["GET"]}


@cell_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationInboxIndexEndpoint(OrganizationInboxEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationInboxIndexPermission,)

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

    @extend_schema(
        operation_id="Update Personal Inbox Items",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InboxFilterSerializer],
        request=InboxUpdateSerializer,
        responses={
            200: inline_sentry_response_serializer("InboxUpdateResponse", InboxUpdateResponse),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: AuthenticatedHttpRequest, organization: Organization
    ) -> Response[InboxUpdateResponse]:
        """Update read state or undo pending removal for matching inbox items.

        Omitting filters selects all items. Read-state updates only affect active items
        unless restoring them. updatedCount includes items already in the requested state.
        """
        filters = InboxFilterSerializer(data=request.GET)
        if not filters.is_valid():
            raise ParseError({"detail": filters.errors})
        serializer = InboxUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            raise ParseError({"detail": serializer.errors})
        updates = serializer.validated_data
        items: QuerySet[InboxItem] = InboxItem.objects.filter(
            organization=organization,
            user_id=require_user(request).id,
        )
        items = filter_inbox_items(items, filters.validated_data)
        if "status" in updates:
            items = items.filter(status__in=[ObjectStatus.ACTIVE, ObjectStatus.PENDING_DELETION])
        else:
            items = items.filter(status=ObjectStatus.ACTIVE)
        return Response({"updatedCount": items.update(**updates)})
