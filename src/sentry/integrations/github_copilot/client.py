from __future__ import annotations

import logging

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.github_copilot.models import (
    GithubCopilotTaskCreateResponse,
    GithubCopilotTaskRequest,
)
from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentState, CodingAgentStatus

logger = logging.getLogger(__name__)


class GithubCopilotAgentClient(CodingAgentClient):
    integration_name = "github_copilot"
    base_url = "https://api.githubcopilot.com"

    def __init__(self, user_access_token: str):
        super().__init__()
        self.token = user_access_token

    def _get_auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "User-Agent": "sentry",
        }

    @staticmethod
    def encode_agent_id(owner: str, repo: str, job_id: str) -> str:
        return f"{owner}:{repo}:{job_id}"

    def launch(self, *, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        owner = request.repository.owner
        repo = request.repository.name

        payload = GithubCopilotTaskRequest(
            problem_statement=request.prompt,
            event_type="sentry",
        )

        logger.info(
            "coding_agent.github_copilot.launch",
            extra={
                "owner": owner,
                "repo": repo,
                "agent_type": self.__class__.__name__,
            },
        )

        api_response = self.post(
            f"/agents/repos/{owner}/{repo}/tasks",
            headers={
                "content-type": "application/json;charset=utf-8",
                **self._get_auth_headers(),
            },
            data=payload.dict(exclude_none=True),
            json=True,
            timeout=60,
        )

        logger.info(
            "coding_agent.github_copilot.response",
            extra={
                "owner": owner,
                "repo": repo,
                "status_code": api_response.status_code,
                "response_body": api_response.json,
                "response_text": api_response.text,
            },
        )

        task_response = GithubCopilotTaskCreateResponse.validate(api_response.json)
        agent_id = self.encode_agent_id(owner, repo, task_response.task.id)

        return CodingAgentState(
            id=agent_id,
            status=CodingAgentStatus.RUNNING,
            provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
            name="GitHub Copilot",
            started_at=task_response.task.created_at,
            agent_url=None,
        )
