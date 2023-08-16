from rest_framework import serializers

from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.api.validators.notifications import validate_scope_type, validate_type, validate_value
from sentry.notifications.types import NOTIFICATION_SETTING_V2_CHOICES
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
            validate_value(int_type, data["value"])
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid type for value")
        return data
