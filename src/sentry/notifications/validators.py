from rest_framework import serializers

from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.validators.notifications import (
    validate_scope_type,
    validate_type,
    validate_value_v2,
)
from sentry.notifications.types import NOTIFICATION_SETTING_V2_CHOICES, NotificationScopeEnum
from sentry.types.integrations import ExternalProviderEnum

allowed_providers = [
    ExternalProviderEnum.EMAIL.value,
    ExternalProviderEnum.SLACK.value,
    ExternalProviderEnum.MSTEAMS.value,
]


class UserNotificationSettingsOptionsDetailsSerializer(CamelSnakeSerializer):
    type = serializers.CharField()
    scope_identifier = serializers.CharField()
    scope_type = serializers.CharField()

    def validate_type(self, value):
        try:
            validate_type(value)
            return value
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid type")

    def validate_scope_type(self, value):
        try:
            validate_scope_type(value)
            return value
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid scope type")


class UserNotificationSettingOptionWithValueSerializer(
    UserNotificationSettingsOptionsDetailsSerializer
):
    value = serializers.CharField()

    def validate_value(self, value):
        if value not in NOTIFICATION_SETTING_V2_CHOICES:
            raise serializers.ValidationError("Invalid value")
        return value

    def validate(self, data):
        try:
            int_type = validate_type(data["type"])
            validate_value_v2(int_type, data["value"])
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid type for value")
        return data


class UserNotificationSettingsProvidersDetailsSerializer(
    UserNotificationSettingsOptionsDetailsSerializer
):
    providers = serializers.ListField(child=serializers.CharField())

    def validate_providers(self, value):
        for provider in value:
            if provider not in allowed_providers:
                raise serializers.ValidationError("Invalid provider")
        return value

    def validate_scope_type(self, value):
        # for now, we limit the scopes for provider settings
        if value not in [
            NotificationScopeEnum.USER.value,
            NotificationScopeEnum.TEAM.value,
            NotificationScopeEnum.ORGANIZATION.value,
        ]:
            raise serializers.ValidationError("Invalid scope type")
        return value
