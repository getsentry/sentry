from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.users.api.serializers.identityprovider import IdentityProviderSerializerResponse
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class IdentitySerializerResponse(TypedDict):
    id: str
    identityProvider: IdentityProviderSerializerResponse
    externalId: str
    status: int


@register(Identity)
class IdentitySerializer(Serializer):
    def serialize(
        self,
        obj: Identity,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IdentitySerializerResponse:
        return {
            "id": str(obj.id),
            "identityProvider": serialize(obj.idp),
            "externalId": obj.external_id,
            "status": obj.status,
        }
