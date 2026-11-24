from collections.abc import Mapping, MutableMapping
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


@register(DocIntegrationAvatar)
class DocIntegrationAvatarSerializer(Serializer[MutableMapping[str, Any]]):
    def serialize(
        self,
        obj: DocIntegrationAvatar,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[str, Any]:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
            "avatarUrl": obj.absolute_url(),
        }
