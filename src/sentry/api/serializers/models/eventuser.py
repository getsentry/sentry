from datetime import datetime
from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.eventuser import EventUser


class EventUserSerializerResponse(TypedDict):
    id: str | None
    tagValue: str | None
    identifier: str | int | None
    username: str | None
    email: str | None
    name: str | None
    ipAddress: str | None
    avatarUrl: str
    hash: str | None
    # Legacy field, always null; typed nullable so it resolves in the OpenAPI schema.
    dateCreated: datetime | None


@register(EventUser)
class EventUserSerializer(Serializer[EventUserSerializerResponse]):
    def serialize(self, obj, attrs, user, **kwargs) -> EventUserSerializerResponse:
        return {
            "id": str(obj.id) if obj.id is not None else obj.id,
            "tagValue": obj.tag_value,
            "identifier": obj.user_ident,
            "username": obj.username,
            "email": obj.email,
            "name": obj.get_display_name(),
            "ipAddress": obj.ip_address,
            "avatarUrl": get_gravatar_url(obj.email, size=32),
            # Legacy fields from `EventUser` model
            "hash": obj.hash,
            "dateCreated": None,
        }
