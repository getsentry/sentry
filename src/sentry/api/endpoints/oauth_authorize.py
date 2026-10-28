from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.oauth_consent import OAuthConsentEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_authorize.approval import approve_authorization
from sentry.api.helpers.oauth_authorize.request import build_authorization_request
from sentry.api.helpers.oauth_authorize.response import (
    InvalidAuthorizationRequest,
    OAuthRedirectError,
    authorization_error,
)
from sentry.api.helpers.oauth_authorize.transactions import (
    consume_authorization_transaction,
    prune_authorization_transactions,
    save_authorization_transaction,
)
from sentry.api.helpers.oauth_consent import get_organization_options, has_existing_consent
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.oauth_consent import (
    OAuthRedirect,
    OAuthRedirectResponse,
    OAuthRedirectSerializer,
)
from sentry.api.serializers.models.organization import (
    ControlSiloOrganizationSerializer,
    ControlSiloOrganizationSerializerResponse,
)
from sentry.api.serializers.rest_framework.oauth_authorize import (
    OAuthAuthorizeQuerySerializer,
)
from sentry.api.serializers.rest_framework.oauth_consent import (
    ConsentDecision,
    ConsentDecisionSerializer,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.auth import AuthenticatedHttpRequest


class OAuthAuthorizeConsentResponse(TypedDict):
    stage: Literal["consent"]
    transactionId: str
    # UI hint for skipping the consent prompt; approval still requires the authenticated
    # decision POST, which validates the bound transaction and current access.
    hasExistingConsent: bool
    organizationOptions: list[ControlSiloOrganizationSerializerResponse]


@dataclass(frozen=True, eq=False)
class OAuthAuthorizeConsent:
    transaction_id: str = field(repr=False)
    organizations: Sequence[RpcOrganizationMapping]
    has_existing_consent: bool


class OAuthAuthorizeConsentSerializer(Serializer[OAuthAuthorizeConsentResponse]):
    def serialize(
        self,
        obj: OAuthAuthorizeConsent,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthAuthorizeConsentResponse:
        return {
            "stage": "consent",
            "transactionId": obj.transaction_id,
            "hasExistingConsent": obj.has_existing_consent,
            "organizationOptions": serialize(
                obj.organizations, serializer=ControlSiloOrganizationSerializer()
            ),
        }


class OAuthAuthorizeDecision(ConsentDecision):
    transaction_id: str


class OAuthAuthorizeDecisionSerializer(ConsentDecisionSerializer[OAuthAuthorizeDecision]):
    transaction_id = serializers.CharField(
        max_length=128, help_text="The session-bound transaction returned by consent preparation."
    )


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthAuthorizeEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (SentryIsAuthenticated, DisallowImpersonatedTokenCreation)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, InvalidAuthorizationRequest):
            return Response({"detail": exc.public_message}, status=400)

        if isinstance(exc, OAuthRedirectError):
            return self.redirect_response(exc.redirect_url)

        return super().handle_exception(exc)

    @staticmethod
    def redirect_response(redirect_url: str) -> Response:
        return Response(
            serialize(OAuthRedirect(redirect_url), serializer=OAuthRedirectSerializer())
        )

    @extend_schema(
        operation_id="Prepare OAuth authorization consent",
        parameters=[OAuthAuthorizeQuerySerializer],
        responses={
            200: inline_sentry_response_serializer(
                "OAuthAuthorizeConsent", OAuthAuthorizeConsentResponse | OAuthRedirectResponse
            )
        },
    )
    def get(self, request: AuthenticatedHttpRequest) -> Response:
        """Prepare consent and report whether the signed-in account has existing consent."""
        serializer = OAuthAuthorizeQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        authorization = build_authorization_request(serializer.validated_data)
        application = authorization.application
        prune_authorization_transactions(request.session)
        organizations = get_organization_options(application, request.user.id)
        if application.requires_org_level_access and not organizations:
            raise InvalidAuthorizationRequest(
                "This authorization flow is only available for users who are members of an organization."
            )

        consent = OAuthAuthorizeConsent(
            transaction_id=save_authorization_transaction(
                request.session, authorization, request.user.id
            ),
            organizations=organizations,
            has_existing_consent=has_existing_consent(
                application, request.user.id, authorization.scopes
            ),
        )
        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=application.id,
                response_type=authorization.response_type,
                outcome="viewed",
            )
        )
        return Response(serialize(consent, serializer=OAuthAuthorizeConsentSerializer()))

    @extend_schema(
        operation_id="Submit OAuth authorization consent",
        request=OAuthAuthorizeDecisionSerializer,
        responses={200: OAuthRedirectSerializer},
    )
    def post(self, request: AuthenticatedHttpRequest) -> Response:
        """Consume prepared consent and return the application's approval or denial callback."""
        serializer = OAuthAuthorizeDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data
        authorization = consume_authorization_transaction(
            request.session, decision["transaction_id"], request.user.id
        )
        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=authorization.application.id,
                response_type=authorization.response_type,
                outcome="approved" if decision["op"] == "approve" else "denied",
            )
        )
        if decision["op"] == "deny":
            raise authorization_error(
                response_type=authorization.response_type,
                redirect_uri=authorization.redirect_uri,
                name="access_denied",
                state=authorization.state,
                client_id=authorization.application.client_id,
            )

        return self.redirect_response(
            approve_authorization(
                authorization, request.user.id, decision["selected_organization_id"]
            )
        )
