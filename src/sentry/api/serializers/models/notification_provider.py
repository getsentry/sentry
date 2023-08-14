from typing import Any, Iterable, Mapping

from sentry.api.serializers import Serializer
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User


class NotificationProviderSerializer(Serializer):
    def serialize(
        self,
        obj: NotificationSettingProvider,
        attrs: Mapping[str, Iterable[Any]],
        user: User,
        **kwargs: Any,
    ) -> Mapping[str, str]:
        return {
            "id": str(obj.id),
            "scopeType": obj.scope_str,
            "scopeIdentifier": str(obj.scope_identifier),
            "notificationType": obj.type_str,
            "value": obj.value_str,
            "provider": obj.provider_str,
            "user_id": obj.user_id,
            "team_id": obj.team_id,
        }
