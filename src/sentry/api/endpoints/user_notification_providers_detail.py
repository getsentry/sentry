from django.db import router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.notification_provider import NotificationProviderSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.validators.integrations import validate_provider
from sentry.api.validators.notifications import validate_scope_type, validate_type_option
from sentry.models import User
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.notifications.types import NotificationSettingOptionValues


class UserNotificationOptionsDetailsSerializer(CamelSnakeSerializer):
    notification_type = serializers.CharField()
    scope_identifier = serializers.CharField()
    scope_type = serializers.CharField()
    provider = serializers.ListField(child=serializers.CharField())


@control_silo_endpoint
class UserNotificationProvidersDetailsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:

        type_option = validate_type_option(request.GET.get("type"))

        notifications_settings = list(
            NotificationSettingProvider.objects.filter(
                type=type_option.value,
                user_id=user.id,
            )
        )

        notification_preferences = serialize(
            notifications_settings, request.user, NotificationProviderSerializer()
        )

        return Response(notification_preferences)

    def put(self, request: Request, user: User) -> Response:
        serializer = UserNotificationOptionsDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return self.respond(serializer.errors, status=400)

        data = serializer.validated_data
        with transaction.atomic(router.db_for_write(NotificationSettingProvider)):
            for provider in ["email", "slack", "msteams"]:
                value = (
                    NotificationSettingOptionValues.ALWAYS
                    if provider in data["provider"]
                    else NotificationSettingOptionValues.NEVER
                )
                NotificationSettingProvider.objects.update_or_create(
                    user_id=user.id,
                    scope_type=validate_scope_type(data["scope_type"]).value,
                    scope_identifier=data["scope_identifier"],
                    type=validate_type_option(data["notification_type"]).value,
                    provider=validate_provider(provider).value,
                    defaults={"value": value.value},
                )
        return Response(status=status.HTTP_204_NO_CONTENT)
