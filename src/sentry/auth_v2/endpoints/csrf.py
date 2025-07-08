from django.conf import settings
from django.http import JsonResponse
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
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
            RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
        }
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
        """
        This endpoint is used to get the HTTPOnly CSRF token.
        """
        response = JsonResponse(
            {
                "detail": "Set CSRF cookie",
                "session": SessionSerializer().serialize(request, {}, request.user),
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            settings.CSRF_COOKIE_NAME,
            request.META.get("CSRF_COOKIE"),
            domain=settings.CSRF_COOKIE_DOMAIN,
        )
        return response

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

        response = JsonResponse(
            {
                "detail": "Rotated CSRF cookie",
                "session": SessionSerializer().serialize(request, {}, request.user),
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            settings.CSRF_COOKIE_NAME,
            request.META.get("CSRF_COOKIE"),
            domain=settings.CSRF_COOKIE_DOMAIN,
        )
        return response
