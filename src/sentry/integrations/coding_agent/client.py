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

    base_url: str

    @abc.abstractmethod
    def _get_auth_headers(self) -> dict[str, str]:
        """Return authentication headers for API requests."""
        pass

    @abc.abstractmethod
    def launch(self, webhook_url: str, **kwargs) -> dict[str, Any]:
        """Launch coding agent with webhook callback."""
        pass
