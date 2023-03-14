from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.notification_action import NotificationActionSerializer
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization, action_id: int) -> Response:
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(serialize(action, request.user))

    def put(self, request: Request, organization: Organization, action_id: int) -> Response:
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = NotificationActionSerializer(
            instance=action,
            context={
                "access": request.access,
                "organization": organization,
                "user": request.user,
            },
            data=request.data,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.save()
        return Response(serialize(action, user=request.user), status=status.HTTP_202_ACCEPTED)

    def delete(self, request: Request, organization: Organization, action_id: int) -> Response:
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=organization.id,
            )
        except NotificationAction.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        action.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
