from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.generic.base import View

from sentry.utils.http import is_valid_origin

if TYPE_CHECKING:
    from sentry.models.apiapplication import ApiApplication

logger = logging.getLogger("sentry.oauth")


class OAuthBaseView(View):
    """
    Base class for OAuth endpoints that need CORS support for browser-based public clients.

    This base class provides:
    - CORS preflight (OPTIONS) handling
    - Origin validation against the application's allowed_origins using is_valid_origin()
    - Automatic CORS header injection on responses when origin is valid

    Usage:
        class MyOAuthView(OAuthBaseView):
            cors_allowed_headers = "Content-Type, Authorization"
            cors_log_tag = "oauth.my-endpoint"

            def post(self, request):
                # Validate application and set self.application
                self.application = validated_app
                ...

    Security:
        - Access-Control-Allow-Credentials is intentionally NOT set (public clients
          use bearer tokens, not cookies)
        - For preflight (OPTIONS), all origins are allowed since we can't validate
          the application yet (client_id isn't sent in preflight requests)
        - For actual requests (POST), origin must match application.allowed_origins
        - Error responses before application validation don't get CORS headers,
          preventing cross-origin scripts from reading error details
    """

    # Subclasses can override these
    cors_allowed_headers: str = "Content-Type"
    cors_log_tag: str = "oauth.cors-rejected"

    # Set during request handling for CORS origin validation
    application: ApiApplication | None = None

    @csrf_exempt
    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        # Handle CORS preflight for browser-based public clients
        response: HttpResponseBase
        if request.method == "OPTIONS":
            response = HttpResponse(status=200)
            response["Access-Control-Max-Age"] = "3600"
        else:
            response = super().dispatch(request, *args, **kwargs)

        return self._add_cors_headers(request, response)

    def _add_cors_headers(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase:
        """Add CORS headers based on application's allowed_origins."""
        origin = request.META.get("HTTP_ORIGIN")

        # Native clients (no Origin header) don't need CORS headers
        if not origin:
            return response

        # For OPTIONS preflight, we don't have the app yet, so allow all origins.
        # The actual POST request will validate the origin against allowed_origins.
        # This is necessary because CORS preflight requests don't include request body
        # parameters like client_id.
        if request.method == "OPTIONS":
            return self._set_cors_headers(response, origin)

        # For POST requests without a validated app (error responses), don't set
        # CORS headers. This is secure: browsers will block cross-origin scripts
        # from reading the error response.
        if not self.application:
            return response

        # For POST requests with a validated app, check allowed_origins using
        # is_valid_origin() which supports wildcards (*, *.example.com), port
        # matching, case-insensitive comparison, and IDNA encoding.
        allowed_origins = self.application.get_allowed_origins()
        if not is_valid_origin(origin, allowed=allowed_origins):
            # Origin not in allowed list - don't set CORS headers.
            # This causes the browser to block the response from being read.
            logger.warning(
                self.cors_log_tag,
                extra={
                    "origin": origin,
                    "allowed_origins": allowed_origins,
                    "client_id": self.application.client_id,
                },
            )
            return response

        return self._set_cors_headers(response, origin)

    def _set_cors_headers(
        self, response: HttpResponseBase, origin: str
    ) -> HttpResponseBase:
        """Set CORS headers on the response for a valid origin."""
        response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = self.cors_allowed_headers
        response["Access-Control-Allow-Origin"] = origin
        return response
