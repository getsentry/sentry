from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import Serializer, serialize
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


class OutgoingNotificationActionSerializer(Serializer):
    def serialize(self, obj: NotificationAction, attrs, user):
        return {}


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(OrganizationEndpoint):
    def get(self, request, organization: Organization, action_id: int):
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(serialize(action, request.user, OutgoingNotificationActionSerializer()))

    def put(self, request, organization: Organization, action_id: int):
        try:
            NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        return Response(status=201)

    def delete(self, request, organization: Organization, action_id: int):
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=404)
        action.delete()
        return Response(status=204)
