from __future__ import annotations

import abc
import logging
from typing import Any

from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.seer.autofix.utils import CodingAgentState

logger = logging.getLogger(__name__)


class CodingAgentClient(ApiClient, abc.ABC):
    """Abstract base API client for coding agents."""

    base_url: str

    def __init__(self, api_key: str | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._api_key = api_key

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        """Inject the x-api-key authentication header when an API key is configured."""
        if self._api_key:
            prepared_request.headers["x-api-key"] = self._api_key
        return prepared_request

    @abc.abstractmethod
    def launch(self, *, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent with webhook callback."""
        pass
