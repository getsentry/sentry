from __future__ import annotations

from typing import Any


class McpIdentityProvider:
    """Mixin for identity providers that back an MCP server."""

    def build_mcp_url(self, identity_data: dict[str, Any]) -> str | None:
        """Build the MCP server URL from the identity's stored ``data`` dict.

        Returns ``None`` when URL cannot be built.
        """
        raise NotImplementedError
