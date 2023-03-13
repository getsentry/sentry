from typing import Tuple

from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.notifications.base import BaseNotificationActionsEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


class OutgoingNotificationActionSerializer(Serializer):
    def serialize(self, obj: NotificationAction, attrs, user):
        return {}


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(BaseNotificationActionsEndpoint):
    def get(
        self, request, organization: Organization, action_trigger: Tuple[int, str], action_id: int
    ):
        trigger_type, _ = action_trigger
        try:
            action = NotificationAction.objects.get(
                id=action_id, organization_id=organization.id, trigger_type=trigger_type
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(serialize(action, request.user, OutgoingNotificationActionSerializer()))

    def put(
        self, request, organization: Organization, action_trigger: Tuple[int, str], action_id: int
    ):
        trigger_type, _ = action_trigger
        try:
            NotificationAction.objects.get(
                id=action_id, organization_id=organization.id, trigger_type=trigger_type
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(status=201)

    def delete(
        self, request, organization: Organization, action_trigger: Tuple[int, str], action_id: int
    ):
        trigger_type, _ = action_trigger
        try:
            action = NotificationAction.objects.get(
                id=action_id, organization_id=organization.id, trigger_type=trigger_type
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        action.delete()
        return Response(status=204)
