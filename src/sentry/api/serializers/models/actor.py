from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, NotRequired, Protocol, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ActorSerializerResponse(TypedDict):
    type: Literal["user", "team"]
    id: str
    name: str
    email: NotRequired[str]


class _Actor(Protocol):
    id: int

    def class_name(self) -> str: ...


class _UserActor(_Actor, Protocol):
    email: str

    def get_display_name(self) -> str: ...


class _TeamActor(_Actor, Protocol):
    slug: str


class ActorSerializer(Serializer[ActorSerializerResponse]):
    def serialize(
        self,
        obj: _Actor,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ActorSerializerResponse:
        if obj.class_name() == "User":
            actor = cast(_UserActor, obj)
            name = actor.get_display_name()
            return ActorSerializerResponse(
                type="user", id=str(actor.id), name=name, email=actor.email
            )

        elif obj.class_name() == "Team":
            team_actor = cast(_TeamActor, obj)
            name = team_actor.slug
            return ActorSerializerResponse(type="team", id=str(team_actor.id), name=name)

        else:
            raise AssertionError(f"Invalid type to assign to: {type(obj)}")
