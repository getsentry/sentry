import logging
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    persist_authorization,
    resolve_organization,
)
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apisetupcode import ApiSetupCode
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import metrics
from sentry.utils.auth import AuthenticatedHttpRequest

logger = logging.getLogger("sentry.oauth")


class OAuthSetupCodeRequest(TypedDict):
    client_id: str
    scopes: list[str]
    organization_id: str | None


class OAuthSetupCodeRequestSerializer(CamelSnakeSerializer[OAuthSetupCodeRequest]):
    client_id = serializers.CharField(
        max_length=64, help_text="The client ID of the application the code is redeemed by."
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(settings.SENTRY_SCOPES)),
        allow_empty=False,
        help_text="The scopes granted to the token issued for the code.",
    )
    organization_id = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        help_text="The organization receiving access for an organization-scoped application.",
    )


class OAuthSetupCodeResponse(TypedDict):
    code: str
    expiresAt: datetime
    scopes: list[str]
    organizationId: str | None


@dataclass(frozen=True, eq=False)
class MintedSetupCode:
    setup_code: ApiSetupCode
    code: str


class OAuthSetupCodeSerializer(Serializer[OAuthSetupCodeResponse]):
    def serialize(
        self,
        obj: MintedSetupCode,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthSetupCodeResponse:
        organization_id = obj.setup_code.organization_id
        return {
            "code": obj.code,
            "expiresAt": obj.setup_code.expires_at,
            "scopes": obj.setup_code.get_scopes(),
            "organizationId": str(organization_id) if organization_id is not None else None,
        }


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthSetupCodeEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (SentryIsAuthenticated, DisallowImpersonatedTokenCreation)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"POST": {RateLimitCategory.USER: RateLimit(limit=10, window=60)}}
    )

    @extend_schema(
        operation_id="Mint an OAuth setup code",
        request=OAuthSetupCodeRequestSerializer,
        responses={201: OAuthSetupCodeSerializer},
    )
    def post(self, request: AuthenticatedHttpRequest) -> Response:
        """
        Mint a short-lived, single-use code that a client exchanges for an OAuth
        token with the `urn:sentry:params:oauth:grant-type:setup_code` grant.
        Minting a code revokes any of the user's unredeemed codes.
        """
        serializer = OAuthSetupCodeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        application = self._get_application(data["client_id"])
        scopes = list(dict.fromkeys(data["scopes"]))
        if application.requires_org_level_access and not set(scopes) <= set(application.scopes):
            raise ValidationError({"scopes": "Requested scopes exceed application permissions."})

        try:
            organization_id = resolve_organization(
                application, request.user.id, data["organization_id"]
            )
        except InvalidOrganizationSelection as exc:
            raise ValidationError({"organizationId": exc.public_message}) from exc

        # Minting a code is the user's consent, as approving a device code is.
        persist_authorization(application, request.user.id, scopes, organization_id)
        setup_code, code = ApiSetupCode.mint(
            application=application,
            user_id=request.user.id,
            scope_list=scopes,
            organization_id=organization_id,
        )

        metrics.incr("oauth_setup_code.mint", sample_rate=1.0)
        logger.info(
            "oauth.setup-code-minted",
            extra={
                "setup_code_id": setup_code.id,
                "application_id": application.id,
                "user_id": request.user.id,
                "organization_id": organization_id,
            },
        )
        return Response(
            serialize(MintedSetupCode(setup_code, code), serializer=OAuthSetupCodeSerializer()),
            status=201,
        )

    def _get_application(self, client_id: str) -> ApiApplication:
        if client_id in options.get("oauth.setup-code.allowed-client-ids"):
            try:
                return ApiApplication.objects.get(
                    client_id=client_id, status=ApiApplicationStatus.active
                )
            except ApiApplication.DoesNotExist:
                pass
        raise ValidationError({"clientId": "Setup codes are not available for this application."})
