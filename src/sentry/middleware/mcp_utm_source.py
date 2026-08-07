from __future__ import annotations

from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.analytics.attributes import (
    MCP_UTM_SOURCE_META,
    mcp_utm_source_scope,
    resolve_mcp_utm_source,
)


def McpUtmSourceMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    """Capture MCP attribution headers for backend analytics events.

    Reads ``X-Sentry-MCP-Utm-Source`` (sent by sentry-mcp) and binds the
    allow-listed value for the request so ``analytics.record()`` can attach it
    to every event envelope recorded during the request.
    """

    def McpUtmSourceMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        value = resolve_mcp_utm_source(request.META.get(MCP_UTM_SOURCE_META))
        with mcp_utm_source_scope(value):
            return get_response(request)

    return McpUtmSourceMiddleware_impl
