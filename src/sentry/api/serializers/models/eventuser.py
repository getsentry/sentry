from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.avatar import get_gravatar_url
from sentry.utils.eventuser import EventUser


class EventUserSerializerResponse(TypedDict):
    id: Annotated[
        str | None,
        ApiDescription("ID of the legacy EventUser record. Null for users built from events"),
    ]
    tagValue: Annotated[
        str | None,
        ApiDescription(
            "Value of the user tag that matches the user, such as id:123 or email:jane@example.com"
        ),
    ]
    identifier: Annotated[int | str | None, ApiDescription("ID the SDK sent for the user")]
    username: Annotated[str | None, ApiDescription("Username the SDK sent for the user")]
    email: Annotated[str | None, ApiDescription("Email address the SDK sent for the user")]
    name: Annotated[str | None, ApiDescription("Display name of the user")]
    ipAddress: Annotated[str | None, ApiDescription("IP address of the user")]
    avatarUrl: Annotated[str, ApiDescription("Gravatar URL of the user's email address")]
    hash: Annotated[
        str | None,
        ApiDescription(
            "MD5 hash of the first set user attribute: id, username, email or IP address"
        ),
    ]
    # Legacy field, always null; typed nullable so it resolves in the OpenAPI schema.
    dateCreated: Annotated[datetime | None, ApiDescription("Legacy field, always null")]


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
