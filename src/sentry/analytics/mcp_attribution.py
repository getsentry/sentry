from __future__ import annotations

import contextlib
import contextvars
from collections.abc import Generator
from dataclasses import dataclass

from django.http import HttpRequest

from sentry.utils.http import is_mcp_request

MCP_CLIENT_META = "HTTP_X_SENTRY_MCP_CLIENT_FAMILY"
MCP_UTM_SOURCE_META = "HTTP_X_SENTRY_MCP_UTM_SOURCE"

KNOWN_MCP_CLIENTS = frozenset(
    {"claude-code", "cursor", "copilot", "opencode", "claude-desktop", "codex"}
)
KNOWN_MCP_UTM_SOURCES = frozenset({"plugin"})


@dataclass(frozen=True)
class McpAttribution:
    mcp: bool = False
    client: str | None = None
    utm_source: str | None = None


_mcp_attribution: contextvars.ContextVar[McpAttribution | None] = contextvars.ContextVar(
    "analytics_mcp_attribution", default=None
)


def _resolve_attribute(raw: str | None, known_values: frozenset[str]) -> str | None:
    if not raw:
        return None

    value = raw.strip().lower()
    if value in known_values:
        return value

    return "other"


def resolve_mcp_attribution(request: HttpRequest) -> McpAttribution:
    if not is_mcp_request(request):
        return McpAttribution()

    return McpAttribution(
        mcp=True,
        client=_resolve_attribute(request.META.get(MCP_CLIENT_META), KNOWN_MCP_CLIENTS),
        utm_source=_resolve_attribute(request.META.get(MCP_UTM_SOURCE_META), KNOWN_MCP_UTM_SOURCES),
    )


@contextlib.contextmanager
def mcp_attribution_scope(attribution: McpAttribution) -> Generator[None]:
    token = _mcp_attribution.set(attribution)
    try:
        yield
    finally:
        _mcp_attribution.reset(token)


def get_mcp_attribution() -> McpAttribution:
    return _mcp_attribution.get() or McpAttribution()
