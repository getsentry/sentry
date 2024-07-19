from collections.abc import MutableMapping
from typing import Any

from sentry.api.serializers import Serializer, register
from sentry.integrations.models.doc_integration_avatar import DocIntegrationAvatar


@register(DocIntegrationAvatar)
class DocIntegrationAvatarSerializer(Serializer):
    def serialize(
        self, obj: DocIntegrationAvatar, attrs, user, **kwargs
    ) -> MutableMapping[str, Any]:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
            "avatarUrl": obj.absolute_url(),
        }
