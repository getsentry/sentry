from collections.abc import Mapping
from typing import Any, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class RollbackOrganizationSerializerResponse(TypedDict):
    id: int
    name: str
    slug: str


class RollbackUserSerializerResponse(TypedDict):
    id: int
    name: str


class RollbackSerializerResponse(TypedDict):
    organization: RollbackOrganizationSerializerResponse
    user: RollbackUserSerializerResponse
    data: dict[str, object]


class UserRollbackSerializer(Serializer[RollbackSerializerResponse]):
    def serialize(
        self,
        obj: Any,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> RollbackSerializerResponse:
        rollback_org = kwargs.get("rollback_org")

        return {
            "organization": {
                "id": obj.organization.id,
                "name": obj.organization.name,
                "slug": obj.organization.slug,
            },
            "user": {
                "id": obj.user_id,
                "name": cast("User | RpcUser", user).name,
            },
            "data": {
                "user": obj.data,
                "organization": rollback_org.data if rollback_org else None,
            },
        }
