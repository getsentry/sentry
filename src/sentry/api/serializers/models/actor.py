from typing import Literal, NotRequired, TypedDict, int

from sentry.api.serializers import Serializer


class ActorSerializerResponse(TypedDict):
    type: Literal["user", "team"]
    id: str
    name: str
    email: NotRequired[str]


class ActorSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> ActorSerializerResponse:
        if obj.class_name() == "User":
            name = obj.get_display_name()
            return ActorSerializerResponse(type="user", id=str(obj.id), name=name, email=obj.email)

        elif obj.class_name() == "Team":
            name = obj.slug
            return ActorSerializerResponse(type="team", id=str(obj.id), name=name)

        else:
            raise AssertionError(f"Invalid type to assign to: {type(obj)}")
