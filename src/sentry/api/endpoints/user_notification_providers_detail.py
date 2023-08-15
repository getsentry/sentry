from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import serialize
from sentry.api.validators.notifications import validate_type
from sentry.models import User
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.serializers import NotificationSettingsProviderSerializer
from sentry.notifications.types import NotificationSettingsOptionEnum
from sentry.notifications.validators import (
    UserNotificationSettingsProvidersDetailsSerializer,
    allowed_providers,
)


@control_silo_endpoint
class UserNotificationProvidersDetailsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:
        notification_type = request.GET.get("type")
        try:
            validate_type(notification_type)
        except ParameterValidationError:
            return self.respond({"type": ["Invalid type"]}, status=400)

        notifications_settings = list(
            NotificationSettingProvider.objects.filter(
                type=notification_type,
                user_id=user.id,
            )
        )

        notification_preferences = serialize(
            notifications_settings, request.user, NotificationSettingsProviderSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        serializer = UserNotificationSettingsProvidersDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        with transaction.atomic(router.db_for_write(NotificationSettingProvider)):
            for provider in allowed_providers:
                value = (
                    NotificationSettingsOptionEnum.ALWAYS.value
                    if provider in data["provider"]
                    else NotificationSettingsOptionEnum.NEVER.value
                )
                NotificationSettingProvider.objects.update_or_create(
                    user_id=user.id,
                    scope_type=data["scope_type"],
                    scope_identifier=data["scope_identifier"],
                    type=data["type"],
                    provider=provider,
                    defaults={"value": value},
                )
        return Response(status=status.HTTP_204_NO_CONTENT)
