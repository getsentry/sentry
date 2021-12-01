from typing import MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppAvatar
from sentry.utils.json import JSONData


@register(SentryAppAvatar)
class SentryAppAvatarSerializer(Serializer):
    def serialize(
        self, obj: SentryAppAvatar, attrs, user, **kwargs
    ) -> MutableMapping[str, JSONData]:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
            "color": obj.color,
        }
