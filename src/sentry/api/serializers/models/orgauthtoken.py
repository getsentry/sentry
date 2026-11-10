from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OrgAuthTokenSerializerResponse(TypedDict):
    id: Annotated[str, ApiDescription("ID of the org auth token")]
    name: Annotated[str, ApiDescription("Name of the org auth token")]
    scopes: Annotated[list[str], ApiDescription("Scopes granted to the token, such as org:ci")]
    tokenLastCharacters: Annotated[
        str | None,
        ApiDescription("Last four characters of the token, to tell tokens apart, or null"),
    ]
    dateCreated: Annotated[datetime, ApiDescription("When the token was created")]
    dateLastUsed: Annotated[
        datetime | None, ApiDescription("When the token last authenticated a request, or null")
    ]
    projectLastUsedId: Annotated[
        str | None,
        ApiDescription("ID of the project the token was last used with, or null"),
    ]
    token: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "The full token. Only included in the response that creates the token, and can't be retrieved again"
            ),
        ]
    ]


@register(OrgAuthToken)
class OrgAuthTokenSerializer(Serializer[OrgAuthTokenSerializerResponse]):
    def serialize(
        self,
        obj: OrgAuthToken,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> OrgAuthTokenSerializerResponse:
        token = cast(str | None, kwargs["token"])
        data: OrgAuthTokenSerializerResponse = {
            "id": str(obj.id),
            "name": obj.name,
            "scopes": obj.get_scopes(),
            "tokenLastCharacters": obj.token_last_characters,
            "dateCreated": obj.date_added,
            "dateLastUsed": obj.date_last_used,
            "projectLastUsedId": (
                str(obj.project_last_used_id) if obj.project_last_used_id else None
            ),
        }

        if token:
            data["token"] = token

        return data
