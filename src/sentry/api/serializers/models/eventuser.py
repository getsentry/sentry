from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.eventuser import EventUser


class EventUserSerializerResponse(TypedDict):
    id: str | None
    tagValue: str | None
    identifier: int | str | None
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
    def serialize(
        self,
        obj: EventUser,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> EventUserSerializerResponse:
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
