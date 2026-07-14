from __future__ import annotations

from typing import Any


class McpIdentityProvider:
    """Mixin for identity providers that back an MCP server."""

    def build_mcp_urls(self, identity_data: dict[str, Any]) -> list[str]:
        """Build MCP server URLs from the identity's stored ``data`` dict.

        Returns a list of URLs. Providers with a single MCP endpoint return
        a one-element list; providers with multiple endpoints (e.g. GCP)
        return several.
        """
        raise NotImplementedError
