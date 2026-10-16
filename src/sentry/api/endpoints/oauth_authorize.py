from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.oauth_consent import OAuthConsentEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_authorize.approval import approve_authorization
from sentry.api.helpers.oauth_authorize.consent import get_consent_context, has_existing_consent
from sentry.api.helpers.oauth_authorize.request import validate_authorization_request
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
from sentry.api.helpers.oauth_consent import (
    ConsentDecision,
    ConsentDecisionSerializer,
    OAuthConsentPermission,
    OAuthConsentResponse,
    OAuthRedirectResponse,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class OAuthAuthorizeDecision(ConsentDecision):
    transaction_id: str


class OAuthAuthorizeDecisionSerializer(ConsentDecisionSerializer[OAuthAuthorizeDecision]):
    transaction_id = serializers.CharField(max_length=128)


def redirect_response(redirect_url: str) -> Response:
    data: OAuthRedirectResponse = {"stage": "redirect", "redirectUrl": redirect_url}
    return Response(data)


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthAuthorizeEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OAuthConsentPermission,)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, InvalidAuthorizationRequest):
            return Response({"detail": exc.public_message}, status=400)

        if isinstance(exc, OAuthRedirectError):
            return redirect_response(exc.redirect_url)

        return super().handle_exception(exc)

    @extend_schema(
        operation_id="Retrieve OAuth authorization consent",
        parameters=[
            OpenApiParameter("client_id", str, required=True),
            OpenApiParameter("response_type", str, required=True, enum=["code", "token"]),
            OpenApiParameter("redirect_uri", str),
            OpenApiParameter("scope", str),
            OpenApiParameter("state", str),
            OpenApiParameter("force_prompt", str),
            OpenApiParameter("code_challenge", str),
            OpenApiParameter("code_challenge_method", str, enum=["S256"]),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OAuthAuthorizeContext", OAuthConsentResponse | OAuthRedirectResponse
            )
        },
    )
    def get(self, request: Request) -> Response:
        assert request.user.is_authenticated
        authorization = validate_authorization_request(request.GET)
        prune_authorization_transactions(request.session)
        if not request.GET.get("force_prompt") and has_existing_consent(
            authorization, request.user.id
        ):
            return redirect_response(approve_authorization(authorization, request.user.id))

        context = get_consent_context(authorization, request.user.id)
        context["transactionId"] = save_authorization_transaction(
            request.session, authorization, request.user.id
        )
        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=authorization.application.id,
                response_type=authorization.response_type,
                outcome="viewed",
            )
        )
        return Response(context)

    @extend_schema(
        operation_id="Submit OAuth authorization consent",
        request=OAuthAuthorizeDecisionSerializer,
        responses={
            200: inline_sentry_response_serializer("OAuthConsentRedirect", OAuthRedirectResponse)
        },
    )
    def post(self, request: Request) -> Response:
        assert request.user.is_authenticated
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

        return redirect_response(
            approve_authorization(
                authorization, request.user.id, decision["selected_organization_id"]
            )
        )
