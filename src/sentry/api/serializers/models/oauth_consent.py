from collections.abc import Mapping, Sequence
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.organization import (
    ControlSiloOrganizationSerializer,
    ControlSiloOrganizationSerializerResponse,
)
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.apiapplication import ApiApplication
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ConsentApplicationResponse(TypedDict):
    clientId: str
    name: str
    homepageUrl: str | None
    privacyUrl: str | None
    termsUrl: str | None
    requiresOrgLevelAccess: bool


class OAuthConsentResponse(TypedDict):
    stage: Literal["consent"]
    application: ConsentApplicationResponse
    scopes: list[str]
    permissions: list[str]
    organizationOptions: list[ControlSiloOrganizationSerializerResponse]
    transactionId: str | None
    userCode: str | None


class ConsentAttrs(TypedDict):
    organizations: list[ControlSiloOrganizationSerializerResponse]


class OAuthConsentSerializer(Serializer[OAuthConsentResponse]):
    def __init__(
        self,
        *,
        scopes: list[str],
        permissions: list[str],
        organization_options: Sequence[RpcOrganizationMapping],
        transaction_id: str | None = None,
        user_code: str | None = None,
    ) -> None:
        self.scopes = scopes
        self.permissions = permissions
        self.organization_options = organization_options
        self.transaction_id = transaction_id
        self.user_code = user_code

    def get_attrs(
        self,
        item_list: Sequence[ApiApplication],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[ApiApplication, ConsentAttrs]:
        organizations = serialize(
            self.organization_options, user=user, serializer=ControlSiloOrganizationSerializer()
        )
        return {application: {"organizations": organizations} for application in item_list}

    def serialize(
        self,
        obj: ApiApplication,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthConsentResponse:
        return {
            "stage": "consent",
            "application": {
                "clientId": obj.client_id,
                "name": obj.name,
                "homepageUrl": obj.homepage_url,
                "privacyUrl": obj.privacy_url,
                "termsUrl": obj.terms_url,
                "requiresOrgLevelAccess": obj.requires_org_level_access,
            },
            "scopes": self.scopes,
            "permissions": self.permissions,
            "organizationOptions": attrs["organizations"],
            "transactionId": self.transaction_id,
            "userCode": self.user_code,
        }
