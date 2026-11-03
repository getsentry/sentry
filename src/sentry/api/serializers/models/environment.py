from collections.abc import Mapping
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.environment import Environment, EnvironmentProject
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class EnvironmentSerializerResponse(TypedDict):
    id: str
    name: str


class EnvironmentProjectSerializerResponse(TypedDict):
    id: str
    name: str
    isHidden: bool


@register(Environment)
class EnvironmentSerializer(Serializer[EnvironmentSerializerResponse]):
    def serialize(
        self,
        obj: Environment,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> EnvironmentSerializerResponse:
        return {"id": str(obj.id), "name": obj.name}


@register(EnvironmentProject)
class EnvironmentProjectSerializer(Serializer[EnvironmentProjectSerializerResponse]):
    def serialize(
        self,
        obj: EnvironmentProject,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> EnvironmentProjectSerializerResponse:
        return {
            "id": str(obj.id),
            "name": obj.environment.name,
            "isHidden": obj.is_hidden is True,
        }
