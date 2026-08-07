from __future__ import annotations

import contextlib
import contextvars
from collections.abc import Generator

# Request-scoped attribution that is snapshotted onto analytics envelopes at
# record time. Keep this allow-listed: analytics data is high-cardinality
# sensitive and ends up in BigQuery as nested JSON.
_mcp_utm_source: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "analytics_mcp_utm_source", default=None
)

MCP_UTM_SOURCE_HEADER = "X-Sentry-MCP-Utm-Source"
MCP_UTM_SOURCE_META = "HTTP_X_SENTRY_MCP_UTM_SOURCE"
MCP_UTM_SOURCE_DATA_KEY = "mcp_utm_source"

# Matches the bucketed values produced by sentry-mcp. Unknown values collapse
# to "other" so free-form headers cannot explode analytics cardinality.
KNOWN_MCP_UTM_SOURCES = frozenset({"plugin"})


def resolve_mcp_utm_source(raw: str | None) -> str | None:
    """Bucket a raw MCP UTM source header value for analytics attribution."""
    if not raw:
        return None
    if raw in KNOWN_MCP_UTM_SOURCES:
        return raw
    return "other"


@contextlib.contextmanager
def mcp_utm_source_scope(value: str | None) -> Generator[None]:
    """Bind an MCP UTM source for the duration of a unit of work."""
    token = _mcp_utm_source.set(value)
    try:
        yield
    finally:
        _mcp_utm_source.reset(token)


def get_mcp_utm_source() -> str | None:
    """Return the current request-scoped MCP UTM source, if any."""
    return _mcp_utm_source.get()
