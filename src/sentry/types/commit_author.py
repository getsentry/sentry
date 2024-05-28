from typing import TypedDict, Union

from sentry.api.serializers.models.user import UserSerializerResponse


class NonMappableUser(TypedDict):
    name: str
    email: str


Author = Union[UserSerializerResponse, NonMappableUser]
