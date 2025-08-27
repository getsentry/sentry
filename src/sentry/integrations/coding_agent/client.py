from __future__ import annotations

import abc
import logging

from sentry.integrations.client import ApiClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.seer.autofix.utils import CodingAgentState

logger = logging.getLogger(__name__)


class CodingAgentClient(ApiClient, abc.ABC):
    """Abstract base API client for coding agents."""

    base_url: str

    def __init__(self, integration):
        self.integration = integration
        super().__init__()

    @abc.abstractmethod
    def launch(self, *, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent with webhook callback."""
        pass
