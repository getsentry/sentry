from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.helpers.oauth_consent import get_permission_descriptions
from sentry.api.serializers import Serializer, serialize
from sentry.models.apiapplication import ApiApplication
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OAuthApplicationResponse(TypedDict):
    clientId: str
    name: str
    homepageUrl: str | None
    privacyUrl: str | None
    termsUrl: str | None
    requiresOrgLevelAccess: bool


class OAuthApplicationSerializer(Serializer[OAuthApplicationResponse]):
    def serialize(
        self,
        obj: ApiApplication,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthApplicationResponse:
        return {
            "clientId": obj.client_id,
            "name": obj.name,
            "homepageUrl": obj.homepage_url,
            "privacyUrl": obj.privacy_url,
            "termsUrl": obj.terms_url,
            "requiresOrgLevelAccess": obj.requires_org_level_access,
        }


class OAuthRequestContextResponse(TypedDict):
    stage: Literal["context"]
    application: OAuthApplicationResponse
    scopes: list[str]
    permissions: list[str]


@dataclass(frozen=True, eq=False)
class OAuthRequestContext:
    application: ApiApplication
    scopes: Sequence[str]


class OAuthRequestContextSerializer(Serializer[OAuthRequestContextResponse]):
    def serialize(
        self,
        obj: OAuthRequestContext,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthRequestContextResponse:
        return {
            "stage": "context",
            "application": serialize(obj.application, serializer=OAuthApplicationSerializer()),
            "scopes": list(obj.scopes),
            "permissions": get_permission_descriptions(obj.scopes),
        }


def serialize_request_context(
    application: ApiApplication, scopes: Sequence[str]
) -> OAuthRequestContextResponse:
    return serialize(
        OAuthRequestContext(application, scopes), serializer=OAuthRequestContextSerializer()
    )


class OAuthRedirectResponse(TypedDict):
    stage: Literal["redirect"]
    redirectUrl: str


@dataclass(frozen=True, eq=False)
class OAuthRedirect:
    redirect_url: str = field(repr=False)


class OAuthRedirectSerializer(Serializer[OAuthRedirectResponse]):
    def serialize(
        self,
        obj: OAuthRedirect,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthRedirectResponse:
        return {"stage": "redirect", "redirectUrl": obj.redirect_url}
