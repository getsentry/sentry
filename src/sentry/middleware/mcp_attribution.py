from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponseBase

from sentry.analytics.mcp_attribution import mcp_attribution_scope, resolve_mcp_attribution


def McpAttributionMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    def middleware(request: HttpRequest) -> HttpResponseBase:
        with mcp_attribution_scope(resolve_mcp_attribution(request)):
            return get_response(request)

    return middleware
