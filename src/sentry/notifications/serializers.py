from __future__ import annotations

from typing import Any, Mapping, Optional

from sentry.api.serializers import Serializer
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider


class NotificationSettingsBaseSerializer(Serializer):
    def serialize(
        self,
        obj: Any,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, Optional[str]]:
        return {
            "id": str(obj.id),
            "scopeType": obj.scope_type,
            "scopeIdentifier": str(obj.scope_identifier),
            "type": obj.type,
            "value": obj.value,
            "user_id": str(obj.user_id) if obj.user_id is not None else None,
            "team_id": str(obj.team_id) if obj.team_id is not None else None,
        }


class NotificationSettingsOptionSerializer(NotificationSettingsBaseSerializer):
    def serialize(
        self,
        obj: NotificationSettingOption,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, Optional[str]]:
        return super().serialize(obj, **kwargs)


class NotificationSettingsProviderSerializer(NotificationSettingsBaseSerializer):
    def serialize(
        self,
        obj: NotificationSettingProvider,
        *args: Any,
        **kwargs: Any,
    ) -> Mapping[str, Optional[str]]:
        output = super().serialize(obj, **kwargs)
        return {
            **output,
            "provider": obj.provider,
        }
