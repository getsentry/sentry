from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.notification_option import NotificationOptionsSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.validators.notifications import validate_scope_type, validate_type_option
from sentry.models import User
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.notifications.types import get_notification_value_from_string


class BaseUserNotificationOptionsDetailsSerializer(CamelSnakeSerializer):
    notification_type = serializers.CharField()
    scope_identifier = serializers.CharField()
    scope_type = serializers.CharField()


class PutUserNotificationOptionsDetailsSerializer(BaseUserNotificationOptionsDetailsSerializer):
    value = serializers.CharField()


# TODO: add validation


@control_silo_endpoint
class UserNotificationOptionsDetailsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:

        type_option = validate_type_option(request.GET.get("type"))

        notifications_settings = list(
            NotificationSettingOption.objects.filter(
                type=type_option.value,
                user_id=user.id,
            )
        )

        notification_preferences = serialize(
            notifications_settings, request.user, NotificationOptionsSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        serializer = PutUserNotificationOptionsDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        NotificationSettingOption.objects.update_or_create(
            user_id=user.id,
            scope_type=validate_scope_type(data["scope_type"]).value,
            scope_identifier=data["scope_identifier"],
            type=validate_type_option(data["notification_type"]).value,
            defaults={"value": get_notification_value_from_string(data["value"]).value},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request: Request, user: User) -> Response:
        serializer = BaseUserNotificationOptionsDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        NotificationSettingOption.objects.filter(
            user_id=user.id,
            scope_type=validate_scope_type(data["scope_type"]).value,
            scope_identifier=data["scope_identifier"],
            type=validate_type_option(data["notification_type"]).value,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
