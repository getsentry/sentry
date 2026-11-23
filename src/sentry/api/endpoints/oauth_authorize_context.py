from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_authorize.request import build_authorization_request
from sentry.api.helpers.oauth_authorize.response import (
    InvalidAuthorizationRequest,
    OAuthRedirectError,
)
from sentry.api.serializers import serialize
from sentry.api.serializers.models.oauth_consent import (
    OAuthRedirect,
    OAuthRedirectResponse,
    OAuthRedirectSerializer,
    OAuthRequestContextResponse,
    serialize_request_context,
)
from sentry.api.serializers.rest_framework.oauth_authorize import OAuthAuthorizeQuerySerializer
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthAuthorizeContextEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    authentication_classes = ()
    permission_classes = ()
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, InvalidAuthorizationRequest):
            return Response({"detail": exc.public_message}, status=400)

        if isinstance(exc, OAuthRedirectError):
            return Response(
                serialize(OAuthRedirect(exc.redirect_url), serializer=OAuthRedirectSerializer())
            )

        return super().handle_exception(exc)

    @extend_schema(
        operation_id="Retrieve public OAuth authorization context",
        parameters=[OAuthAuthorizeQuerySerializer],
        responses={
            200: inline_sentry_response_serializer(
                "OAuthRequestContext", OAuthRequestContextResponse | OAuthRedirectResponse
            )
        },
    )
    def get(self, request: Request) -> Response:
        """Validate an authorization request and describe its application and permissions."""
        serializer = OAuthAuthorizeQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        authorization = build_authorization_request(serializer.validated_data)
        return Response(serialize_request_context(authorization.application, authorization.scopes))
