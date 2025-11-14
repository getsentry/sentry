from typing import int
from unittest.mock import MagicMock, patch

from sentry.integrations.cursor.client import CursorAgentClient
from sentry.testutils.cases import TestCase


class CursorClientTest(TestCase):

    def setUp(self):
        self.integration = MagicMock()
        # Avoid shadowing TestCase.client attribute used by Django
        self.cursor_client = CursorAgentClient(
            api_key="test_api_key_123", webhook_secret="test_webhook_secret"
        )

    @patch("sentry.integrations.cursor.client.CursorAgentClient.post")
    def test_launch(self, mock_post):
        from datetime import datetime

        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentStatus
        from sentry.seer.models import SeerRepoDefinition

        # Mock the response
        mock_response = MagicMock()
        mock_response.json = {
            "id": "test_session_123",
            "name": "Test Session",
            "status": "running",
            "createdAt": datetime.now().isoformat(),
            "source": {
                "repository": "https://github.com/testorg/testrepo",
                "ref": "main",
            },
            "target": {
                "url": "https://github.com/org/repo/pull/1",
                "autoCreatePr": True,
                "branchName": "fix-bug",
            },
        }
        mock_post.return_value = mock_response

        # Create a launch request
        request = CodingAgentLaunchRequest(
            prompt="Fix the bug",
            repository=SeerRepoDefinition(
                integration_id="123",
                provider="github",
                owner="testorg",
                name="testrepo",
                external_id="456",
                branch_name="main",
            ),
            branch_name="fix-bug",
        )

        webhook_url = "https://sentry.io/webhook"
        result = self.cursor_client.launch(webhook_url=webhook_url, request=request)

        # Verify the API call
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == "/v0/agents"

        # Verify headers
        headers = call_args[1]["headers"]
        assert headers["Authorization"] == "Bearer test_api_key_123"
        assert headers["content-type"] == "application/json;charset=utf-8"

        # Verify result
        assert result.id == "test_session_123"
        assert result.status == CodingAgentStatus.RUNNING
        assert result.provider == CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        assert result.name == "Test Session"
