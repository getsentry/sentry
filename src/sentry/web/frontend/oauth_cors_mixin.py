from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt

if TYPE_CHECKING:
    from sentry.models.apiapplication import ApiApplication

logger = logging.getLogger("sentry.oauth")


class OAuthCORSMixin:
    """
    Mixin that adds CORS support for OAuth endpoints used by browser-based public clients.

    This mixin provides:
    - CORS preflight (OPTIONS) handling
    - Origin validation against the application's allowed_origins
    - Automatic CORS header injection on all responses

    Usage:
        class MyOAuthView(OAuthCORSMixin, View):
            cors_allowed_headers = "Content-Type, Authorization"
            cors_log_tag = "oauth.my-endpoint"

            def post(self, request):
                # Validate application and set self.application
                self.application = validated_app
                ...

    Security:
        - Access-Control-Allow-Credentials is intentionally NOT set
        - For preflight (OPTIONS), all origins are allowed since we don't have the app yet
        - For actual requests, origin must be in application.allowed_origins
    """

    # Subclasses should set these
    cors_allowed_headers: str = "Content-Type"
    cors_log_tag: str = "oauth.cors-rejected"

    # Set during request handling for CORS origin validation
    application: ApiApplication | None = None

    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request, *args, **kwargs) -> HttpResponseBase:
        # Handle CORS preflight for browser-based public clients
        response: HttpResponseBase
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
            response["Access-Control-Max-Age"] = "3600"
        else:
            response = super().dispatch(request, *args, **kwargs)  # type: ignore[misc]

        return self._add_cors_headers(request, response)

    def _add_cors_headers(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        """Add CORS headers based on application's allowed_origins."""
        origin = request.META.get("HTTP_ORIGIN")

        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = self.cors_allowed_headers

        # For OPTIONS preflight, we don't have the app yet, so allow all origins
        # The actual POST request will validate the origin against allowed_origins
        if not self.application:
            if origin:
                response["Access-Control-Allow-Origin"] = origin
            else:
                response["Access-Control-Allow-Origin"] = "*"
            return response

        # For POST requests, validate origin against allowed_origins
        allowed = self.application.get_allowed_origins()
        if not allowed or origin not in allowed:
            # Origin not in allowed list - don't set Access-Control-Allow-Origin
            # This causes the browser to block the response
            logger.warning(
                self.cors_log_tag,
                extra={
                    "origin": origin,
                    "allowed_origins": allowed,
                    "client_id": self.application.client_id,
                },
            )
            return response

        response["Access-Control-Allow-Origin"] = origin
        return response
