from django.middleware.csrf import rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.auth_v2.endpoints.base import AuthV2Endpoint
from sentry.auth_v2.serializers import SessionSerializer
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@control_silo_endpoint
class CsrfTokenEndpoint(AuthV2Endpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
            RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
        },
        "PUT": {
            RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
            RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
        },
    }

    @extend_schema(
        operation_id="Retrieve the CSRF token in your session",
        parameters=[],
        responses={
            "detail": "string",
            "session": SessionSerializer,
        },
    )
    @method_decorator(ensure_csrf_cookie)
    def get(self, request, *args, **kwargs):
        return self.respond(
            {
                "detail": "Set CSRF cookie",
                "session": SessionSerializer().serialize(request, {}, request.user),
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        operation_id="Rotate the CSRF token in your session",
        parameters=[],
        responses={
            "detail": "string",
            "session": SessionSerializer,
        },
    )
    @method_decorator(ensure_csrf_cookie)
    def put(self, request, *args, **kwargs):
        rotate_token(request)
        return self.respond(
            {
                "detail": "Rotated CSRF cookie",
                "session": SessionSerializer().serialize(request, {}, request.user),
            },
            status=status.HTTP_200_OK,
        )
