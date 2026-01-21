from unittest.mock import Mock, patch

from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.github_copilot.models import GithubCopilotTaskStatusResponse
from sentry.testutils.cases import TestCase


class GithubCopilotAgentClientTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.access_token = "test_access_token"
        self.copilot_client = GithubCopilotAgentClient(user_access_token=self.access_token)

    def test_encode_agent_id(self) -> None:
        """Test that encode_agent_id correctly formats the agent ID"""
        agent_id = GithubCopilotAgentClient.encode_agent_id(
            owner="getsentry", repo="sentry", job_id="task-123"
        )
        assert agent_id == "getsentry:sentry:task-123"

    def test_decode_agent_id_valid(self) -> None:
        """Test that decode_agent_id correctly parses a valid agent ID"""
        result = GithubCopilotAgentClient.decode_agent_id("getsentry:sentry:task-123")
        assert result == ("getsentry", "sentry", "task-123")

    def test_decode_agent_id_with_colons_in_task_id(self) -> None:
        """Test that decode_agent_id handles task IDs containing colons"""
        result = GithubCopilotAgentClient.decode_agent_id("getsentry:sentry:task:with:colons")
        assert result == ("getsentry", "sentry", "task:with:colons")

    def test_decode_agent_id_invalid_format(self) -> None:
        """Test that decode_agent_id returns None for invalid formats"""
        assert GithubCopilotAgentClient.decode_agent_id("invalid") is None
        assert GithubCopilotAgentClient.decode_agent_id("only:two") is None
        assert GithubCopilotAgentClient.decode_agent_id("") is None

    def test_encode_decode_roundtrip(self) -> None:
        """Test that encode and decode are inverses of each other"""
        owner, repo, job_id = "getsentry", "sentry", "task-abc-123"
        encoded = GithubCopilotAgentClient.encode_agent_id(owner, repo, job_id)
        decoded = GithubCopilotAgentClient.decode_agent_id(encoded)
        assert decoded == (owner, repo, job_id)

    @patch.object(GithubCopilotAgentClient, "get")
    def test_get_task_status(self, mock_get: Mock) -> None:
        """Test that get_task_status correctly fetches and parses task status"""
        mock_response = Mock()
        mock_response.json = {
            "id": "task-123",
            "status": "completed",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T01:00:00Z",
            "artifacts": [
                {
                    "provider": "github",
                    "type": "pull_request",
                    "data": {"id": 456, "type": "pull", "global_id": "PR_abc123"},
                }
            ],
        }
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        result = self.copilot_client.get_task_status(
            owner="getsentry", repo="sentry", task_id="task-123"
        )

        assert isinstance(result, GithubCopilotTaskStatusResponse)
        assert result.id == "task-123"
        assert result.status == "completed"
        assert result.artifacts is not None
        assert len(result.artifacts) == 1
        assert result.artifacts[0].data.type == "pull"
        assert result.artifacts[0].data.global_id == "PR_abc123"

        mock_get.assert_called_once_with(
            "/agents/repos/getsentry/sentry/tasks/task-123",
            headers={"Authorization": "Bearer test_access_token", "User-Agent": "sentry"},
            timeout=30,
        )

    @patch.object(GithubCopilotAgentClient, "get")
    def test_get_task_status_no_artifacts(self, mock_get: Mock) -> None:
        """Test that get_task_status handles responses without artifacts"""
        mock_response = Mock()
        mock_response.json = {
            "id": "task-123",
            "status": "running",
        }
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        result = self.copilot_client.get_task_status(
            owner="getsentry", repo="sentry", task_id="task-123"
        )

        assert result.id == "task-123"
        assert result.status == "running"
        assert result.artifacts is None

    @patch.object(GithubCopilotAgentClient, "post")
    def test_get_pr_from_graphql_success(self, mock_post: Mock) -> None:
        """Test that get_pr_from_graphql correctly fetches PR info"""
        mock_response = Mock()
        mock_response.json = {
            "data": {
                "node": {
                    "number": 12345,
                    "title": "Fix the bug",
                    "url": "https://github.com/getsentry/sentry/pull/12345",
                }
            }
        }
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = self.copilot_client.get_pr_from_graphql(global_id="PR_abc123")

        assert result is not None
        assert result.number == 12345
        assert result.title == "Fix the bug"
        assert result.url == "https://github.com/getsentry/sentry/pull/12345"

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["data"]["variables"]["id"] == "PR_abc123"

    @patch.object(GithubCopilotAgentClient, "post")
    def test_get_pr_from_graphql_not_found(self, mock_post: Mock) -> None:
        """Test that get_pr_from_graphql returns None when PR is not found"""
        mock_response = Mock()
        mock_response.json = {"data": {"node": None}}
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = self.copilot_client.get_pr_from_graphql(global_id="PR_invalid")

        assert result is None

    @patch.object(GithubCopilotAgentClient, "post")
    def test_get_pr_from_graphql_empty_node(self, mock_post: Mock) -> None:
        """Test that get_pr_from_graphql handles empty node response"""
        mock_response = Mock()
        mock_response.json = {"data": {"node": {}}}
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = self.copilot_client.get_pr_from_graphql(global_id="PR_invalid")

        assert result is None
