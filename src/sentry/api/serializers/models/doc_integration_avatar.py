from typing import MutableMapping

from sentry.api.serializers import Serializer, register
from sentry.models import DocIntegrationAvatar
from sentry.utils.json import JSONData


@register(DocIntegrationAvatar)
class DocIntegrationAvatarSerializer(Serializer):
    def serialize(
        self, obj: DocIntegrationAvatar, attrs, user, **kwargs
    ) -> MutableMapping[str, JSONData]:
        return {
            "avatarType": obj.get_avatar_type_display(),
            "avatarUuid": obj.ident,
        }
