from typing import Any, Mapping

from sentry.api.serializers import Serializer, register
from sentry.models.notificationsettingbase import NotificationSettingBase
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider


class NotificationSettingsBaseSerializer(Serializer):
    def serialize(
        self,
        obj: NotificationSettingBase,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, str]:
        return {
            "id": str(obj.id),
            "scopeType": obj.scope_type,
            "scopeIdentifier": str(obj.scope_identifier),
            "notificationType": obj.type,
            "value": obj.value,
            "user_id": str(obj.user_id) if obj.user_id is not None else None,
            "team_id": str(obj.team_id) if obj.team_id is not None else None,
        }


@register(NotificationSettingOption)
class NotificationSettingsOptionSerializer(NotificationSettingsBaseSerializer):
    def serialize(
        self,
        obj: NotificationSettingOption,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, str]:
        return super().serialize(obj, **kwargs)


@register(NotificationSettingProvider)
class NotificationSettingsProviderSerializer(NotificationSettingsBaseSerializer):
    def serialize(
        self,
        obj: NotificationSettingProvider,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, str]:
        output = super().serialize(obj, **kwargs)
        output["provider"] = obj.provider
        return output
