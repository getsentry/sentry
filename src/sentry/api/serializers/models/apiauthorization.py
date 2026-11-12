from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TypedDict, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.apiapplication import ApiApplicationSerializerResponse
from sentry.models.apiauthorization import ApiAuthorization
from sentry.organizations.services.organization import organization_service
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ApiAuthorizationSerializerResponse(TypedDict):
    id: str
    scopes: list[str]
    application: ApiApplicationSerializerResponse | None
    dateCreated: datetime
    organization: object


@register(ApiAuthorization)
class ApiAuthorizationSerializer(Serializer[ApiAuthorizationSerializerResponse]):
    def get_attrs(
        self,
        item_list: Sequence[ApiAuthorization],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[ApiAuthorization, dict[str, object]]:
        apps = {
            d["id"]: d
            for d in serialize({i.application for i in item_list if i.application_id}, user)
        }

        attrs: dict[ApiAuthorization, dict[str, object]] = {}
        for item in item_list:
            attrs[item] = {
                "application": (apps.get(item.application.client_id) if item.application else None)
            }
        return attrs

    def serialize(
        self,
        obj: ApiAuthorization,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ApiAuthorizationSerializerResponse:
        data: ApiAuthorizationSerializerResponse = {
            "id": str(obj.id),
            "scopes": obj.get_scopes(),
            "application": cast(ApiApplicationSerializerResponse | None, attrs["application"]),
            "dateCreated": obj.date_added,
            "organization": (
                organization_service.serialize_organization(id=obj.organization_id)
                if obj.organization_id
                else None
            ),
        }
        return data
