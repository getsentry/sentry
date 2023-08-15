from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import serialize
from sentry.api.validators.notifications import validate_type
from sentry.models import User
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.serializers import NotificationSettingsOptionSerializer
from sentry.notifications.validators import (
    UserNotificationSettingOptionWithValueSerializer,
    UserNotificationSettingsOptionsDetailsSerializer,
)


@control_silo_endpoint
class UserNotificationOptionsDetailsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:

        notification_type = request.GET.get("type")
        try:
            validate_type(notification_type)
        except ParameterValidationError:
            return self.respond({"type": ["Invalid type"]}, status=400)

        notifications_settings = list(
            NotificationSettingOption.objects.filter(
                type=notification_type,
                user_id=user.id,
            )
        )

        notification_preferences = serialize(
            notifications_settings, request.user, NotificationSettingsOptionSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        serializer = UserNotificationSettingOptionWithValueSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        NotificationSettingOption.objects.update_or_create(
            user_id=user.id,
            scope_type=data["scope_type"],
            scope_identifier=data["scope_identifier"],
            type=data["type"],
            defaults={"value": data["value"]},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request: Request, user: User) -> Response:
        serializer = UserNotificationSettingsOptionsDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        try:
            option = NotificationSettingOption.objects.get(
                user_id=user.id,
                scope_type=data["scope_type"],
                scope_identifier=data["scope_identifier"],
                type=data["type"],
            )
        except NotificationSettingOption.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        option.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
