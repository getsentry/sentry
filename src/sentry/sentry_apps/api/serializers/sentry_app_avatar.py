from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.sentry_apps.services.app.model import RpcSentryAppAvatar
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class SentryAppAvatarSerializerResponse(TypedDict):
    avatarType: str
    avatarUuid: str
    avatarUrl: str
    color: bool
    photoType: str


@register(SentryAppAvatar)
class SentryAppAvatarSerializer(Serializer):
    def serialize(
        self,
        obj: SentryAppAvatar | RpcSentryAppAvatar,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SentryAppAvatarSerializerResponse:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident or "",
            "avatarUrl": obj.absolute_url(),
            "color": obj.color,
            "photoType": obj.get_avatar_photo_type(),
        }
