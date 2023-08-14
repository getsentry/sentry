from typing import Any, Iterable, Mapping

from sentry.api.serializers import Serializer
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.user import User


class NotificationOptionsSerializer(Serializer):
    def serialize(
        self,
        obj: NotificationSettingOption,
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
            "user_id": obj.user_id,
            "team_id": obj.team_id,
        }
