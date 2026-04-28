from typing import Any

from django.middleware.csrf import rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.auth_v2 import AuthV2CsrfTokenRotated
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.auth_v2.utils.session import SessionSerializer
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@control_silo_endpoint
class CsrfTokenEndpoint(Endpoint):
    """
    NOTE: This endpoint is not protected by the feature flag in AuthV2Endpoint!
    """

    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = ()

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
                RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
            },
            "PUT": {
                RateLimitCategory.USER: RateLimit(limit=10, window=60),  # 10 per minute per user
                RateLimitCategory.IP: RateLimit(limit=20, window=60),  # 20 per minute per IP
            },
        }
    )

    @extend_schema(
        operation_id="Retrieve the CSRF token in your session",
        parameters=[],
        responses={
            "detail": "string",
            "session": SessionSerializer,
        },
    )
    @method_decorator(ensure_csrf_cookie)
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
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
    def put(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        rotate_token(request)
        if referrer := request.GET.get("referrer"):
            analytics.record(
                AuthV2CsrfTokenRotated(
                    event=referrer,
                )
            )

        return self.respond(
            {
                "detail": "Rotated CSRF cookie",
                "session": SessionSerializer().serialize(request, {}, request.user),
            },
            status=status.HTTP_200_OK,
        )
