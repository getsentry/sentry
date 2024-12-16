from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.environment import Environment, EnvironmentProject


class EnvironmentSerializerResponse(TypedDict):
    id: str
    name: str


class EnvironmentProjectSerializerResponse(TypedDict):
    id: str
    name: str
    isHidden: bool


@register(Environment)
class EnvironmentSerializer(Serializer):
    def serialize(self, obj: Environment, attrs, user, **kwargs) -> EnvironmentSerializerResponse:
        return {"id": str(obj.id), "name": obj.name}


@register(EnvironmentProject)
class EnvironmentProjectSerializer(Serializer):
    def serialize(
        self, obj: EnvironmentProject, attrs, user, **kwargs
    ) -> EnvironmentProjectSerializerResponse:
        return {
            "id": str(obj.id),
            "name": obj.environment.name,
            "isHidden": obj.is_hidden is True,
        }
