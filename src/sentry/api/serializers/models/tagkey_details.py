from typing import TypedDict

from sentry.api.serializers import Serializer


class TagKeyDetailsSerializerResponse(TypedDict):
    key: str
    totalValues: int


class TagKeyDetailsSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> TagKeyDetailsSerializerResponse:
        return {
            "key": obj.key,
            "totalValues": obj.totalValues,
        }
