from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone

import orjson

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentState, CodingAgentStatus

logger = logging.getLogger(__name__)


class OutpostAgentClient(CodingAgentClient):
    integration_name = "outpost"

    def __init__(self, base_url: str, shared_secret: str, callback_secret: str):
        super().__init__()
        self.base_url = base_url.rstrip("/")
        self.shared_secret = shared_secret
        self.callback_secret = callback_secret

    def _sign_body(self, body: bytes) -> str:
        sig = hmac.new(self.shared_secret.encode(), body, hashlib.sha256).hexdigest()
        return f"sha256={sig}"

    def launch(self, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        payload = {
            "prompt": request.prompt,
            "repository": {
                "provider": request.repository.provider,
                "owner": request.repository.owner,
                "name": request.repository.name,
                "external_id": request.repository.external_id,
                "branch_name": request.repository.branch_name,
            },
            "branch_name": request.branch_name,
            "auto_create_pr": request.auto_create_pr,
            "webhook_url": webhook_url,
            "webhook_secret": self.callback_secret,
        }
        body = orjson.dumps(payload)
        repo = f"{request.repository.owner}/{request.repository.name}"

        logger.info("coding_agent.outpost.launch", extra={"base_url": self.base_url, "repo": repo})

        api_response = self.post(
            "/webhooks/seer",
            headers={
                "content-type": "application/json;charset=utf-8",
                "x-seer-signature-256": self._sign_body(body),
            },
            data=payload,
            json=True,
            timeout=60,
        )

        data = api_response.json
        agent_id = data.get("id", "")
        status_str = data.get("status", "pending")
        name = data.get("name", f"Outpost Agent: {repo}")

        return CodingAgentState(
            id=agent_id,
            status=CodingAgentStatus.RUNNING if status_str == "running" else CodingAgentStatus.FAILED,
            provider=CodingAgentProviderType.OUTPOST_AGENT,
            name=name,
            started_at=datetime.now(timezone.utc),
        )
