from collections.abc import Mapping
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.apikey import ApiKey
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ApiKeySerializerResponse(TypedDict):
    id: str
    label: str
    key: str
    scope_list: list[str]
    status: int
    allowed_origins: str


@register(ApiKey)
class ApiKeySerializer(Serializer[ApiKeySerializerResponse]):
    def serialize(
        self,
        obj: ApiKey,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ApiKeySerializerResponse:
        return {
            "id": str(obj.id),
            "label": obj.label,
            "key": obj.key,
            "scope_list": obj.scope_list,
            "status": obj.status,
            "allowed_origins": "" if obj.allowed_origins is None else str(obj.allowed_origins),
        }
