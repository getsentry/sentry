from __future__ import annotations

import abc
import logging
from typing import Any

from sentry.integrations.client import ApiClient

logger = logging.getLogger(__name__)


class CodingAgentClient(ApiClient, abc.ABC):
    """Abstract base API client for coding agents."""

    def __init__(self, integration, api_key: str):
        self.integration = integration
        self.api_key = api_key
        super().__init__()

    @property
    @abc.abstractmethod
    def base_url(self) -> str:
        """Return the base URL for the agent API."""
        pass

    @abc.abstractmethod
    def _get_auth_headers(self) -> dict[str, str]:
        """Return authentication headers for API requests."""
        pass

    def request(self, method: str, path: str, **kwargs) -> Any:
        """Make authenticated request to agent API."""
        kwargs.setdefault("headers", {})
        kwargs["headers"].update(self._get_auth_headers())
        kwargs["headers"]["Content-Type"] = "application/json"

        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

        try:
            return self._request(method, url, **kwargs)
        except Exception as e:
            logger.exception(
                "coding_agent.api_error",
                extra={
                    "error": str(e),
                    "path": path,
                    "method": method,
                    "agent_type": self.__class__.__name__,
                },
            )
            raise

    @abc.abstractmethod
    def launch(self, webhook_url: str, **kwargs) -> dict[str, Any]:
        """Launch coding agent with webhook callback."""
        pass
