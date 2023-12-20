from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers import serialize
from sentry.api.validators.notifications import validate_type
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.notifications.serializers import NotificationSettingsProviderSerializer
from sentry.notifications.types import NotificationSettingsOptionEnum
from sentry.notifications.validators import UserNotificationSettingsProvidersDetailsSerializer
from sentry.types.integrations import PERSONAL_NOTIFICATION_PROVIDERS


@control_silo_endpoint
class UserNotificationSettingsProvidersEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES
    # TODO(Steve): Make not private when we launch new system
    private = True

    def get(self, request: Request, user: User) -> Response:
        """
        Retrieve the notification provider preferences for a user.
        Returns a list of NotificationSettingProvider rows.
        """
        notifications_settings = NotificationSettingProvider.objects.filter(
            user_id=user.id,
        )
        notification_type = request.GET.get("type")
        if notification_type:
            try:
                validate_type(notification_type)
            except ParameterValidationError:
                return self.respond({"type": ["Invalid type"]}, status=400)
            notifications_settings = notifications_settings.filter(
                type=notification_type,
            )

        notification_preferences = serialize(
            list(notifications_settings), request.user, NotificationSettingsProviderSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        """
        Update the notification provider preferences for a user.
        Provider is an array of provider names.
        Returns an array of NotificationSettingProvider rows for the updated providers.
        """
        serializer = UserNotificationSettingsProvidersDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        new_rows = []
        with transaction.atomic(router.db_for_write(NotificationSettingProvider)):
            for provider in PERSONAL_NOTIFICATION_PROVIDERS:
                value = (
                    NotificationSettingsOptionEnum.ALWAYS.value
                    if provider in data["providers"]
                    else NotificationSettingsOptionEnum.NEVER.value
                )
                (
                    notification_setting_provider,
                    _,
                ) = NotificationSettingProvider.objects.update_or_create(
                    user_id=user.id,
                    scope_type=data["scope_type"],
                    scope_identifier=data["scope_identifier"],
                    type=data["type"],
                    provider=provider,
                    defaults={"value": value},
                )
                new_rows.append(notification_setting_provider)
        return Response(
            serialize(new_rows, request.user, NotificationSettingsProviderSerializer()),
            status=status.HTTP_201_CREATED,
        )
