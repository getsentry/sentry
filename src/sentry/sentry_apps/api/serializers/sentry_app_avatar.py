from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.sentry_apps.services.app.model import RpcSentryAppAvatar


class SentryAppAvatarSerializerResponse(TypedDict):
    avatarType: str
    avatarUuid: str
    avatarUrl: str
    color: bool
    photoType: str


@register(SentryAppAvatar)
class SentryAppAvatarSerializer(Serializer):
    def serialize(
        self, obj: SentryAppAvatar | RpcSentryAppAvatar, attrs, user, **kwargs
    ) -> SentryAppAvatarSerializerResponse:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident or "",
            "avatarUrl": obj.absolute_url(),
            "color": obj.color,
            "photoType": obj.get_avatar_photo_type(),
        }
