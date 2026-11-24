from collections.abc import Mapping
from typing import Annotated, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import NumericId, numeric_id
from sentry.models.environment import Environment, EnvironmentProject
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class EnvironmentSerializerResponse(TypedDict):
    id: Annotated[NumericId, ApiDescription("ID of the environment")]
    name: Annotated[str, ApiDescription("Name of the environment")]


class EnvironmentProjectSerializerResponse(TypedDict):
    id: Annotated[NumericId, ApiDescription("ID of the environment")]
    name: Annotated[str, ApiDescription("Name of the environment")]
    isHidden: Annotated[bool, ApiDescription("Whether the environment is hidden in the project")]


@register(Environment)
class EnvironmentSerializer(Serializer[EnvironmentSerializerResponse]):
    def serialize(
        self,
        obj: Environment,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> EnvironmentSerializerResponse:
        return {"id": numeric_id(obj.id), "name": obj.name}


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
            "id": numeric_id(obj.id),
            "name": obj.environment.name,
            "isHidden": obj.is_hidden is True,
        }
