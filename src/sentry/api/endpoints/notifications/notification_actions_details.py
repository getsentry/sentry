from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.notifications.base import BaseNotificationActionsEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


class NotificationActionSerializer(Serializer):
    def serialize(self, obj: NotificationAction, attrs, user):
        return {
            "id": str(obj.id),
            "organizationId": obj.organization_id,
            "integrationId": obj.integration_id,
            "triggerType": obj.triggerType,
            "targetType": obj.triggerType,
            "targetIdentifier": obj.target_identifier,
            "targetDisplay": obj.target_display,
            "targetConfig": obj.target_config,
        }


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(BaseNotificationActionsEndpoint):
    def get(self, request, organization: Organization, action_id: int):
        try:
            action = NotificationAction.objects.get(id=action_id, organization_id=organization.id)
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(serialize(action, request.user, NotificationActionSerializer()))

    def put(self, request, organization: Organization, action_id: int):
        try:
            NotificationAction.objects.get(id=action_id, organization_id=organization.id)
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(status=201)

    def delete(self, request, organization: Organization, action_id: int):
        try:
            action = NotificationAction.objects.get(id=action_id, organization_id=organization.id)
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        action.delete()
        return Response(status=204)
