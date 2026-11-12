from typing import TypedDict

from rest_framework import serializers

from sentry.api.exceptions import ParameterValidationError
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.db.models.fields.bounded import I64_MAX
from sentry.integrations.types import PERSONAL_NOTIFICATION_PROVIDERS
from sentry.notifications.api.parsers.notifications import (
    validate_scope_type,
    validate_type,
    validate_value,
)
from sentry.notifications.types import (
    INBOX_NOTIFICATION_SETTINGS,
    NOTIFICATION_SETTING_CHOICES,
    NotificationScopeEnum,
    NotificationSettingEnum,
)


class UserNotificationSettingData(TypedDict, total=False):
    type: str
    scope_type: str
    scope_identifier: int
    value: str
    providers: list[str]


class UserNotificationSettingsOptionsDetailsSerializer(
    CamelSnakeSerializer[UserNotificationSettingData]
):
    type = serializers.CharField()
    scope_identifier = serializers.IntegerField(min_value=0, max_value=I64_MAX)
    scope_type = serializers.CharField()

    def validate_type(self, value: str) -> str:
        try:
            validate_type(value)
            return value
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid type")

    def validate_scope_type(self, value: str) -> str:
        try:
            validate_scope_type(value)
            return value
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid scope type")

    def validate(self, data: UserNotificationSettingData) -> UserNotificationSettingData:
        # Inbox settings apply across all of a user's organizations, so they only accept user scope.
        if (
            NotificationSettingEnum(data["type"]) in INBOX_NOTIFICATION_SETTINGS
            and data["scope_type"] != NotificationScopeEnum.USER.value
        ):
            raise serializers.ValidationError("Inbox settings only allow user scope")
        return data


class UserNotificationSettingOptionWithValueSerializer(
    UserNotificationSettingsOptionsDetailsSerializer
):
    value = serializers.CharField()

    def validate_value(self, value: str) -> str:
        if value not in NOTIFICATION_SETTING_CHOICES:
            raise serializers.ValidationError("Invalid value")
        return value

    def validate(self, data: UserNotificationSettingData) -> UserNotificationSettingData:
        data = super().validate(data)
        try:
            enum_type = validate_type(data["type"])
            validate_value(enum_type, data["value"])
        except ParameterValidationError:
            raise serializers.ValidationError("Invalid type for value")
        return data


class UserNotificationSettingsProvidersDetailsSerializer(
    UserNotificationSettingsOptionsDetailsSerializer
):
    providers = serializers.ListField(child=serializers.CharField())

    def validate_providers(self, value: list[str]) -> list[str]:
        for provider in value:
            if provider not in PERSONAL_NOTIFICATION_PROVIDERS:
                raise serializers.ValidationError("Invalid provider")
        return value

    def validate_scope_type(self, value: str) -> str:
        # for now, we limit the scopes for provider settings
        if value not in [
            NotificationScopeEnum.USER.value,
            NotificationScopeEnum.TEAM.value,
            NotificationScopeEnum.ORGANIZATION.value,
        ]:
            raise serializers.ValidationError("Invalid scope type")
        return value
