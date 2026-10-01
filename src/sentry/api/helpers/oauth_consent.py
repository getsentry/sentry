from collections.abc import Sequence
from typing import Literal, TypedDict, TypeVar

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.apiapplication import ApiApplication
from sentry.utils.auth import has_pending_2fa


class ConsentApplicationResponse(TypedDict):
    clientId: str
    name: str
    homepageUrl: str | None
    privacyUrl: str | None
    termsUrl: str | None
    requiresOrgLevelAccess: bool


class ConsentOrganizationResponse(TypedDict):
    id: str
    slug: str
    name: str


class OAuthConsentResponse(TypedDict):
    stage: Literal["consent"]
    application: ConsentApplicationResponse
    scopes: list[str]
    permissions: list[str]
    organizationOptions: list[ConsentOrganizationResponse]
    transactionId: str | None
    userCode: str | None


class OAuthRedirectResponse(TypedDict):
    stage: Literal["redirect"]
    redirectUrl: str


class ConsentDecision(TypedDict):
    op: Literal["approve", "deny"]
    selected_organization_id: str | None


ConsentDecisionT = TypeVar("ConsentDecisionT", bound=ConsentDecision)


class ConsentDecisionSerializer(CamelSnakeSerializer[ConsentDecisionT]):
    op = serializers.ChoiceField(choices=("approve", "deny"))
    selected_organization_id = serializers.CharField(required=False, allow_null=True, default=None)


def serialize_consent(
    *,
    application: ApiApplication,
    scopes: list[str],
    permissions: list[str],
    organization_options: Sequence[RpcOrganizationMapping],
    transaction_id: str | None = None,
    user_code: str | None = None,
) -> OAuthConsentResponse:
    return {
        "stage": "consent",
        "application": {
            "clientId": application.client_id,
            "name": application.name,
            "homepageUrl": application.homepage_url,
            "privacyUrl": application.privacy_url,
            "termsUrl": application.terms_url,
            "requiresOrgLevelAccess": application.requires_org_level_access,
        },
        "scopes": scopes,
        "permissions": permissions,
        "organizationOptions": [
            {"id": str(organization.id), "slug": organization.slug, "name": organization.name}
            for organization in organization_options
        ],
        "transactionId": transaction_id,
        "userCode": user_code,
    }


class OAuthConsentPermission(SentryIsAuthenticated):
    def has_permission(self, request: Request, view: APIView) -> bool:
        return super().has_permission(request, view) and not has_pending_2fa(request)
