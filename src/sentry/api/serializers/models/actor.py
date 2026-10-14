from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal, NotRequired, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.models.team import Team
from sentry.organizations.services.organization.model import RpcTeam
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ActorSerializerResponse(TypedDict):
    type: Literal["user", "team"]
    id: str
    name: str
    email: NotRequired[str]


class ActorSerializer(Serializer[ActorSerializerResponse]):
    def serialize(
        self,
        obj: User | RpcUser | Team | RpcTeam,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> ActorSerializerResponse:
        if isinstance(obj, (User, RpcUser)):
            name = obj.get_display_name()
            return ActorSerializerResponse(type="user", id=str(obj.id), name=name, email=obj.email)

        elif isinstance(obj, (Team, RpcTeam)):
            name = obj.slug
            return ActorSerializerResponse(type="team", id=str(obj.id), name=name)

        else:
            raise AssertionError(f"Invalid type to assign to: {type(obj)}")
