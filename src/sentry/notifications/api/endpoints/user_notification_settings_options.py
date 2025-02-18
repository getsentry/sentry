from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import serialize
from sentry.notifications.api.validators.notifications import validate_type
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.serializers import NotificationSettingsOptionSerializer
from sentry.notifications.validators import UserNotificationSettingOptionWithValueSerializer
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User


@control_silo_endpoint
class UserNotificationSettingsOptionsEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ALERTS_NOTIFICATIONS

    def get(self, request: Request, user: User) -> Response:
        """
        Retrieve the notification preferences for a user.
        Returns a list of NotificationSettingOption rows.
        """
        notification_type = request.GET.get("type")
        notifications_settings = NotificationSettingOption.objects.filter(user_id=user.id)
        if notification_type:
            try:
                validate_type(notification_type)
            except ParameterValidationError:
                return self.respond({"type": ["Invalid type"]}, status=status.HTTP_400_BAD_REQUEST)
            notifications_settings = notifications_settings.filter(type=notification_type)

        notification_preferences = serialize(
            list(notifications_settings), request.user, NotificationSettingsOptionSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        """
        Update the notification preferences for a user.
        Returns the new row of NotificationSettingOption.
        """
        serializer = UserNotificationSettingOptionWithValueSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        notification_option, _ = NotificationSettingOption.objects.update_or_create(
            user_id=user.id,
            scope_type=data["scope_type"],
            scope_identifier=data["scope_identifier"],
            type=data["type"],
            defaults={"value": data["value"]},
        )
        return Response(
            serialize(notification_option, request.user, NotificationSettingsOptionSerializer()),
            status=status.HTTP_201_CREATED,
        )
