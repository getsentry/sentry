from unittest.mock import Mock, patch

from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.client import CursorAgentClient
from sentry.seer.models import SeerRepoDefinition
from sentry.testutils.cases import TestCase


class CursorAgentClientTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.api_key = "test_api_key"
        self.webhook_secret = "test_webhook_secret"
        self.cursor_client = CursorAgentClient(
            api_key=self.api_key, webhook_secret=self.webhook_secret
        )
        self.webhook_url = "https://example.com/webhook"

        self.repo_definition = SeerRepoDefinition(
            integration_id="111",
            provider="github",
            owner="getsentry",
            name="sentry",
            external_id="123456",
            branch_name="main",
        )

    @patch.object(CursorAgentClient, "post")
    def test_launch_with_auto_create_pr_true(self, mock_post: Mock) -> None:
        """Test that launch() correctly passes auto_create_pr=True to the API"""
        # Setup mock response
        mock_response = Mock()
        mock_response.json = {
            "id": "agent_123",
            "status": "running",
            "name": "Test Agent",
            "createdAt": "2023-01-01T00:00:00Z",
            "source": {
                "repository": "https://github.com/getsentry/sentry",
                "ref": "main",
            },
            "target": {
                "url": "https://cursor.com/agent/123",
                "autoCreatePr": True,
                "branchName": "fix-bug-123",
            },
        }
        mock_post.return_value = mock_response

        # Create launch request with auto_create_pr=True
        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=self.repo_definition,
            branch_name="fix-bug-123",
            auto_create_pr=True,
        )

        # Launch the agent
        self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        # Assert that post was called with correct parameters
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]

        # Verify the payload contains autoCreatePr=True
        payload = call_kwargs["data"]
        assert payload["target"]["autoCreatePr"] is True

    @patch.object(CursorAgentClient, "post")
    def test_launch_with_auto_create_pr_false(self, mock_post: Mock) -> None:
        """Test that launch() correctly passes auto_create_pr=False to the API"""
        # Setup mock response
        mock_response = Mock()
        mock_response.json = {
            "id": "agent_123",
            "status": "running",
            "name": "Test Agent",
            "createdAt": "2023-01-01T00:00:00Z",
            "source": {
                "repository": "https://github.com/getsentry/sentry",
                "ref": "main",
            },
            "target": {
                "url": "https://cursor.com/agent/123",
                "autoCreatePr": False,
                "branchName": "fix-bug-123",
            },
        }
        mock_post.return_value = mock_response

        # Create launch request with auto_create_pr=False
        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=self.repo_definition,
            branch_name="fix-bug-123",
            auto_create_pr=False,
        )

        # Launch the agent
        self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        # Assert that post was called with correct parameters
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]

        # Verify the payload contains autoCreatePr=False
        payload = call_kwargs["data"]
        assert payload["target"]["autoCreatePr"] is False

    @patch.object(CursorAgentClient, "post")
    def test_launch_default_auto_create_pr(self, mock_post: Mock) -> None:
        """Test that launch() defaults auto_create_pr to False when not specified"""
        # Setup mock response
        mock_response = Mock()
        mock_response.json = {
            "id": "agent_123",
            "status": "running",
            "name": "Test Agent",
            "createdAt": "2023-01-01T00:00:00Z",
            "source": {
                "repository": "https://github.com/getsentry/sentry",
                "ref": "main",
            },
            "target": {
                "url": "https://cursor.com/agent/123",
                "autoCreatePr": False,
                "branchName": "fix-bug-123",
            },
        }
        mock_post.return_value = mock_response

        # Create launch request without specifying auto_create_pr (should default to False)
        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=self.repo_definition,
            branch_name="fix-bug-123",
        )

        # Launch the agent
        self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        # Assert that post was called with correct parameters
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]

        # Verify the payload contains autoCreatePr=False (the default)
        payload = call_kwargs["data"]
        assert payload["target"]["autoCreatePr"] is False
