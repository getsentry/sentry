from __future__ import annotations

import logging
from typing import Any

import orjson
import requests

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.integrations.cursor.models import (
    CursorAgentLaunchRequestBody,
    CursorAgentLaunchRequestPrompt,
    CursorAgentLaunchRequestTarget,
    CursorAgentLaunchRequestWebhook,
    CursorAgentSource,
)

logger = logging.getLogger(__name__)


class CursorAgentClient(CodingAgentClient):
    """Cursor-specific API client."""

    integration_name = "cursor"
    api_key: str

    def __init__(self, integration: CursorAgentIntegration, api_key: str):
        self.api_key = api_key
        super().__init__(integration)

    @property
    def base_url(self) -> str:
        return "https://api.cursor.com"

    def _get_auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> dict[str, Any]:
        """Launch coding agent with webhook callback."""
        payload = CursorAgentLaunchRequestBody(
            prompt=CursorAgentLaunchRequestPrompt(
                text=request.prompt,
            ),
            source=CursorAgentSource(
                repository=f"https://github.com/{request.repository.owner}/{request.repository.name}",
                ref=request.repository.branch_name,
            ),
            webhook=CursorAgentLaunchRequestWebhook(url=webhook_url),
            target=CursorAgentLaunchRequestTarget(
                autoCreatePr=True, branchName=request.branch_name
            ),
        )

        logger.info(
            "coding_agent.cursor.launch",
            extra={
                "webhook_url": webhook_url,
                "agent_type": self.__class__.__name__,
            },
        )

        body = orjson.dumps(payload.dict(exclude_none=True))
        url = f"{self.base_url}/v0/agents"

        response = requests.post(
            url,
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
        )

        response.raise_for_status()

        return response.json()
