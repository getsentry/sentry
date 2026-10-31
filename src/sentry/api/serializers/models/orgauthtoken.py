from collections.abc import Mapping
from datetime import datetime
from typing import NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OrgAuthTokenSerializerResponse(TypedDict):
    id: str
    name: str
    scopes: list[str]
    tokenLastCharacters: str | None
    dateCreated: datetime
    dateLastUsed: datetime | None
    projectLastUsedId: str | None
    token: NotRequired[str]


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
