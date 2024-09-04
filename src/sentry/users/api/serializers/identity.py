from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.interfaces.user import User
from sentry.users.api.serializers.identityprovider import IdentityProviderSerializerResponse
from sentry.users.models.identity import Identity


class IdentitySerializerResponse(TypedDict):
    id: str
    identityProvider: IdentityProviderSerializerResponse
    externalId: str
    status: int


@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(
        self, obj: Identity, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> IdentitySerializerResponse:
        return {
            "id": str(obj.id),
            "identityProvider": serialize(obj.idp),
            "externalId": obj.external_id,
            "status": obj.status,
        }
