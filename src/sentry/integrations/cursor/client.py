from __future__ import annotations

import logging
from typing import Any

import orjson
import requests
from pydantic import BaseModel

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest

logger = logging.getLogger(__name__)


class CursorAgentLaunchRequestPrompt(BaseModel):
    text: str
    images: list[dict] = []


class CursorAgentLaunchRequestSource(BaseModel):
    repository: str
    ref: str = "main"


class CursorAgentLaunchRequestWebhook(BaseModel):
    url: str
    secret: str | None = None


class CursorAgentLaunchRequestTarget(BaseModel):
    autoCreatePr: bool
    branchName: str


class CursorAgentLaunchRequestBody(BaseModel):
    prompt: CursorAgentLaunchRequestPrompt
    source: CursorAgentLaunchRequestSource
    model: str | None = None
    target: CursorAgentLaunchRequestTarget | None = None
    webhook: CursorAgentLaunchRequestWebhook | None = None


class CursorAgentClient(CodingAgentClient):
    """Cursor-specific API client."""

    integration_name = "cursor"

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
            source=CursorAgentLaunchRequestSource(
                repository=f"https://github.com/{request.repository.owner}/{request.repository.name}",
                ref=request.repository.branch_name,
            ),
            webhook=CursorAgentLaunchRequestWebhook(url=webhook_url),
            target=CursorAgentLaunchRequestTarget(
                autoCreatePr=True, branchName=request.branch_name
            ),
        )

        logger.info(
            "coding_agent.launch",
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
