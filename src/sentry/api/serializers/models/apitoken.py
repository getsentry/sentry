from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import NotRequired, TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.apiapplication import ApiApplicationSerializerResponse
from sentry.models.apitoken import ApiToken
from sentry.types.token import AuthTokenType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ApiTokenSerializerResponse(TypedDict):
    id: str
    scopes: list[str]
    name: str | None
    application: ApiApplicationSerializerResponse | None
    expiresAt: datetime | None
    dateCreated: datetime
    state: str | None
    token: NotRequired[str]
    refreshToken: NotRequired[str]
    tokenLastCharacters: str | None


@register(ApiToken)
class ApiTokenSerializer(Serializer[ApiTokenSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[ApiToken],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[ApiToken, dict[str, object]]:
        apps = {
            d["id"]: d
            for d in serialize({i.application for i in item_list if i.application_id}, user)
        }

        attrs: dict[ApiToken, dict[str, object]] = {}
        for item in item_list:
            attrs[item] = {
                "application": (apps.get(item.application.client_id) if item.application else None)
            }
        return attrs

    def serialize(
        self,
        obj: ApiToken,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ApiTokenSerializerResponse:
        data: ApiTokenSerializerResponse = {
            "id": str(obj.id),
            "scopes": obj.get_scopes(),
            "name": obj.name,
            "application": cast(ApiApplicationSerializerResponse | None, attrs["application"]),
            "expiresAt": obj.expires_at,
            "dateCreated": obj.date_added,
            "state": cast(str | None, attrs.get("state")),
            "tokenLastCharacters": obj.token_last_characters,
        }
        if not attrs["application"]:
            include_token = kwargs.get("include_token", True)
            if include_token:
                data["token"] = obj.plaintext_token

                if not obj.token_type == AuthTokenType.USER:
                    data["refreshToken"] = obj.plaintext_refresh_token

        """
        While this is a nullable column at the db level, this should never be empty. If it is, it's a sign that the
        token was created through improper channels, and might actually be invalid. If that's the case, it can be
        considered a security risk, and better for this to throw an exception than to leak a dangerous token.
        """
        return data
