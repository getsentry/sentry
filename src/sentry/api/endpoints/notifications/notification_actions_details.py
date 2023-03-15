from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.notification_action import NotificationActionSerializer
from sentry.models.notificationaction import NotificationAction
from sentry.models.organization import Organization


@region_silo_endpoint
class NotificationActionsDetailsEndpoint(FlaggedOrganizationEndpoint):
    """
    Manages a single NotificationAction via the action_id passed in the path.
    GET: Returns the serialized NotificationAction
    PUT: Update the entire NotificationAction, overwriting previous values
    DELETE: Delete the NotificationAction
    """

    feature_flags = ["organizations:notification-actions"]

    def convert_args(self, request: Request, action_id: int, *args, **kwargs):
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        try:
            action = NotificationAction.objects.get(
                id=action_id,
                organization_id=parsed_kwargs["organization"].id,
            )
        except NotificationAction.DoesNotExist:
            raise ResourceDoesNotExist

        parsed_kwargs["action"] = action

        return (parsed_args, parsed_kwargs)

    def get(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        return Response(serialize(action, request.user))

    def put(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
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

    def delete(
        self, request: Request, organization: Organization, action: NotificationAction
    ) -> Response:
        action.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
