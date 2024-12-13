from collections.abc import MutableMapping
from typing import Any

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar


@register(SentryAppAvatar)
class SentryAppAvatarSerializer(Serializer):
    def serialize(self, obj: SentryAppAvatar, attrs, user, **kwargs) -> MutableMapping[str, Any]:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
            "avatarUrl": obj.absolute_url(),
            "color": obj.color,
        }
