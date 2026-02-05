from __future__ import annotations

import logging
from datetime import datetime

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.github_copilot.models import (
    GithubCopilotTask,
    GithubCopilotTaskRequest,
    GithubCopilotTaskResponse,
    GithubPRFromGraphQL,
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
    def encode_agent_id(owner: str, repo: str, task_id: str) -> str:
        return f"{owner}:{repo}:{task_id}"

    @staticmethod
    def decode_agent_id(agent_id: str) -> tuple[str, str, str] | None:
        parts = agent_id.split(":", 2)
        if len(parts) != 3:
            return None
        return (parts[0], parts[1], parts[2])

    def launch(self, *, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        owner = request.repository.owner
        repo = request.repository.name

        # GitHub Copilot has a 30000 character limit for problem_statement.
        # Truncate with some buffer and log a warning if needed.
        max_prompt_length = 29900
        prompt = request.prompt
        if len(prompt) > max_prompt_length:
            original_length = len(prompt)
            prompt = prompt[:max_prompt_length]
            logger.warning(
                "coding_agent.github_copilot.prompt_truncated",
                extra={
                    "owner": owner,
                    "repo": repo,
                    "original_length": original_length,
                    "truncated_length": max_prompt_length,
                },
            )

        payload = GithubCopilotTaskRequest(
            problem_statement=prompt,
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

        task_response = GithubCopilotTaskResponse.validate(api_response.json)
        task = task_response.task

        agent_id = self.encode_agent_id(owner, repo, task.id)

        # Get created_at from the response
        started_at = None
        created_at_str = task.created_at
        if created_at_str:
            try:
                started_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except ValueError:
                pass

        return CodingAgentState(
            id=agent_id,
            status=CodingAgentStatus.RUNNING,
            provider=CodingAgentProviderType.GITHUB_COPILOT_AGENT,
            name=f"{owner}/{repo}: GitHub Copilot",
            started_at=started_at,
            agent_url=None,
        )

    def get_task_status(self, owner: str, repo: str, task_id: str) -> GithubCopilotTask:
        api_response = self.get(
            f"/agents/repos/{owner}/{repo}/tasks/{task_id}",
            headers=self._get_auth_headers(),
            timeout=30,
        )

        logger.info(
            "coding_agent.github_copilot.get_task_status",
            extra={
                "owner": owner,
                "repo": repo,
                "task_id": task_id,
                "status_code": api_response.status_code,
            },
        )

        return GithubCopilotTaskResponse.validate(api_response.json).task

    def get_pr_from_graphql(self, global_id: str) -> GithubPRFromGraphQL | None:
        query = """
            query($id: ID!) {
                node(id: $id) {
                    ... on PullRequest {
                        number
                        title
                        url
                    }
                }
            }
        """

        api_response = self.post(
            "https://api.github.com/graphql",
            headers={
                **self._get_auth_headers(),
                "content-type": "application/json",
            },
            data={"query": query, "variables": {"id": global_id}},
            json=True,
            timeout=30,
        )

        logger.info(
            "coding_agent.github_copilot.get_pr_from_graphql",
            extra={
                "global_id": global_id,
                "status_code": api_response.status_code,
            },
        )

        node = api_response.json.get("data", {}).get("node")
        if not node or "number" not in node:
            return None

        return GithubPRFromGraphQL(
            number=node["number"],
            title=node["title"],
            url=node["url"],
        )
