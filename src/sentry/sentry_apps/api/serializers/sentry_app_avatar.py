from collections.abc import Mapping
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import Url, absolute_url
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.sentry_apps.services.app.model import RpcSentryAppAvatar
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class SentryAppAvatarSerializerResponse(TypedDict):
    avatarType: Annotated[str, ApiDescription("Avatar type: `default` or `upload`")]
    avatarUuid: Annotated[
        str,
        ApiDescription(
            "Unique identifier of the uploaded avatar file, or an empty string if none is set"
        ),
    ]
    avatarUrl: Annotated[Url, ApiDescription("Absolute URL of the avatar image")]
    color: Annotated[
        bool, ApiDescription("Whether this is the color logo (`true`) or the simple icon (`false`)")
    ]
    photoType: Annotated[
        str,
        ApiDescription("Kind of image: `logo` for the color logo or `icon` for the simple icon"),
    ]


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
            "avatarUrl": absolute_url(obj.absolute_url()),
            "color": obj.color,
            "photoType": obj.get_avatar_photo_type(),
        }
