from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.models.userrole import UserRole
from sentry.users.services.user import RpcUser


class UserRoleSerializerResponse(TypedDict):
    id: str
    name: str
    permissions: list[str]
    dateCreated: datetime | None
    dateUpdated: datetime | None


@register(UserRole)
class UserRoleSerializer(Serializer):
    def serialize(
        self,
        obj: UserRole,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> UserRoleSerializerResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "permissions": obj.permissions,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
