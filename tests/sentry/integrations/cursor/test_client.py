from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
import responses
from requests.adapters import Retry

from sentry.integrations.cursor.client import CursorAgentClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase


class CursorClientTest(TestCase):

    def setUp(self):
        self.integration = MagicMock()
        # Avoid shadowing TestCase.client attribute used by Django
        self.cursor_client = CursorAgentClient(
            api_key="test_api_key_123", webhook_secret="test_webhook_secret"
        )

    def test_build_session_has_retry_config(self):
        """Test that build_session creates a session with proper retry configuration."""
        session = self.cursor_client.build_session()

        # Get the adapter from the session
        adapter = session.get_adapter("https://api.cursor.com")

        # Verify retry configuration
        assert adapter.max_retries is not None
        assert isinstance(adapter.max_retries, Retry)
        assert adapter.max_retries.total == 3
        assert adapter.max_retries.backoff_factor == 0.5
        assert adapter.max_retries.status_forcelist == [500, 502, 503, 504]
        assert "POST" in adapter.max_retries.allowed_methods
        # Verify timeout retry behavior
        assert adapter.max_retries.connect == 3  # Retry connection timeouts
        assert adapter.max_retries.read == 0  # Don't retry read timeouts

    @patch("sentry.integrations.cursor.client.CursorAgentClient.post")
    def test_launch(self, mock_post):
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

    @responses.activate
    def test_launch_retries_on_server_error(self):
        """Test that the client retries on 5xx errors."""
        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.models import SeerRepoDefinition

        # First two calls return 503, third succeeds
        responses.add(
            responses.POST,
            "https://api.cursor.com/v0/agents",
            status=503,
        )
        responses.add(
            responses.POST,
            "https://api.cursor.com/v0/agents",
            status=503,
        )
        responses.add(
            responses.POST,
            "https://api.cursor.com/v0/agents",
            json={
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
            },
            status=200,
        )

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

        # Verify it succeeded after retries
        assert result.id == "test_session_123"
        # Verify it made 3 attempts (2 failures + 1 success)
        assert len(responses.calls) == 3

    @responses.activate
    def test_launch_fails_after_max_retries(self):
        """Test that the client fails after exhausting retries."""
        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.models import SeerRepoDefinition

        # All calls return 503
        for _ in range(4):  # initial + 3 retries
            responses.add(
                responses.POST,
                "https://api.cursor.com/v0/agents",
                status=503,
            )

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

        with pytest.raises(ApiError):
            self.cursor_client.launch(webhook_url=webhook_url, request=request)

        # Verify it made 4 attempts (initial + 3 retries)
        assert len(responses.calls) == 4

    @responses.activate
    def test_launch_does_not_retry_on_client_error(self):
        """Test that the client does not retry on 4xx errors."""
        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.models import SeerRepoDefinition

        # Return 400 Bad Request
        responses.add(
            responses.POST,
            "https://api.cursor.com/v0/agents",
            json={"error": "Bad request"},
            status=400,
        )

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

        with pytest.raises(ApiError):
            self.cursor_client.launch(webhook_url=webhook_url, request=request)

        # Verify it only made 1 attempt (no retries on 4xx)
        assert len(responses.calls) == 1

    def test_launch_retries_on_connection_timeout(self):
        """Test that the client retries on connection timeout errors."""
        from unittest.mock import Mock

        from requests.exceptions import ConnectTimeout

        from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
        from sentry.seer.models import SeerRepoDefinition

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

        # Mock the post method to raise ConnectTimeout
        with patch.object(
            self.cursor_client, "post", side_effect=ConnectTimeout("Connection timeout")
        ):
            with pytest.raises(ConnectTimeout):
                self.cursor_client.launch(webhook_url=webhook_url, request=request)

        # Note: The actual retry behavior happens at the session/adapter level,
        # so this test verifies that ConnectTimeout exceptions are properly propagated
