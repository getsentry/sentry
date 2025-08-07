from __future__ import annotations

from typing import Any

from sentry.integrations.coding_agent.client import CodingAgentClient


class CursorAgentClient(CodingAgentClient):
    """Cursor-specific API client."""

    integration_name = "cursor"
    base_url = "https://api.cursor.sh/v1"

    def _get_auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def launch(self, webhook_url: str, **kwargs: Any) -> dict[str, Any]:
        """Launch coding agent with webhook callback."""
        payload = {"webhook_url": webhook_url, **kwargs}

        return self.request("POST", "/launch", json=payload)
