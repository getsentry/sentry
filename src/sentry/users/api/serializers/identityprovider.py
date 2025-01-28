from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.users.models.identity import IdentityProvider
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class IdentityProviderSerializerResponse(TypedDict):
    id: str
    type: str
    externalId: str | None


@register(IdentityProvider)
class IdentityProviderSerializer(Serializer):
    def serialize(
        self,
        obj: IdentityProvider,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> IdentityProviderSerializerResponse:
        return {
            "id": str(obj.id),
            "type": obj.type,
            "externalId": obj.external_id,
        }
