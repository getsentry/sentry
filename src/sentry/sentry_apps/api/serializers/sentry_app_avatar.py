from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar


class SentryAppAvatarSerializerResponse(TypedDict):
    avatarType: str
    avatarUuid: str
    avatarUrl: str
    color: bool
    photo_type: str


@register(SentryAppAvatar)
class SentryAppAvatarSerializer(Serializer):
    def serialize(
        self, obj: SentryAppAvatar, attrs, user, **kwargs
    ) -> SentryAppAvatarSerializerResponse:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
            "avatarUrl": obj.absolute_url(),
            "color": obj.color,
            "photo_type": obj.get_avatar_photo_type(),
        }
