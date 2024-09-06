from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.users.models.identity import IdentityProvider
from sentry.users.models.user import User


class IdentityProviderSerializerResponse(TypedDict):
    id: str
    type: str
    externalId: str | None


@register(IdentityProvider)
class IdentityProviderSerializer(Serializer):
    def serialize(
        self, obj: IdentityProvider, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> IdentityProviderSerializerResponse:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "externalId": obj.external_id,
        }
