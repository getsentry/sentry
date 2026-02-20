from unittest.mock import Mock, patch

import pytest

from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.client import CursorAgentClient
from sentry.seer.models import SeerRepoDefinition
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiForbiddenError,
    ApiRateLimitedError,
    ApiUnauthorized,
)
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

        self.launch_request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=self.repo_definition,
            branch_name="fix-bug-123",
            auto_create_pr=True,
        )

    def _make_success_response(self) -> Mock:
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
        return mock_response

    def _make_models_response(self, models: list[str]) -> Mock:
        mock_response = Mock()
        mock_response.json = {"models": models}
        return mock_response

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

    @patch.object(CursorAgentClient, "post")
    def test_launch_with_empty_branch_name_uses_default(self, mock_post: Mock) -> None:
        """Test that launch() excludes ref when branch_name is empty, allowing Cursor to use repo default"""
        # Setup mock response
        mock_response = Mock()
        mock_response.json = {
            "id": "agent_123",
            "status": "running",
            "name": "Test Agent",
            "createdAt": "2023-01-01T00:00:00Z",
            "source": {
                "repository": "https://github.com/getsentry/sentry",
                "ref": "main",  # Cursor returns the resolved default branch
            },
            "target": {
                "url": "https://cursor.com/agent/123",
                "autoCreatePr": False,
                "branchName": "fix-bug-123",
            },
        }
        mock_post.return_value = mock_response

        # Create repo definition with empty branch_name
        repo_definition_empty_branch = SeerRepoDefinition(
            integration_id="111",
            provider="github",
            owner="getsentry",
            name="sentry",
            external_id="123456",
            branch_name="",  # Empty string
        )

        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=repo_definition_empty_branch,
            branch_name="fix-bug-123",
        )

        # Launch the agent
        self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        # Assert that post was called with correct parameters
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]

        # Verify the payload does NOT contain ref (it's excluded when None)
        # This allows Cursor to use the repo's default branch
        payload = call_kwargs["data"]
        assert "ref" not in payload["source"]

    @patch.object(CursorAgentClient, "post")
    def test_launch_response_without_optional_target_fields(self, mock_post: Mock) -> None:
        """Test that launch() succeeds when Cursor omits optional target fields like branchName and autoCreatePr"""
        mock_response = Mock()
        mock_response.json = {
            "id": "agent_123",
            "status": "CREATING",
            "name": "Test Agent",
            "createdAt": "2023-01-01T00:00:00Z",
            "source": {
                "repository": "https://github.com/getsentry/sentry",
            },
            "target": {
                "url": "https://cursor.com/agent/123",
                # branchName and autoCreatePr intentionally absent
            },
        }
        mock_post.return_value = mock_response

        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=self.repo_definition,
            branch_name="fix-bug-123",
            auto_create_pr=True,
        )

        result = self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        assert result is not None
        assert result.id == "agent_123"
        assert result.agent_url == "https://cursor.com/agent/123"

    @patch.object(CursorAgentClient, "post")
    def test_launch_with_none_branch_name_uses_default(self, mock_post: Mock) -> None:
        """Test that launch() excludes ref when branch_name is None, allowing Cursor to use repo default"""
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

        # Create repo definition with None branch_name
        repo_definition_none_branch = SeerRepoDefinition(
            integration_id="111",
            provider="github",
            owner="getsentry",
            name="sentry",
            external_id="123456",
            branch_name=None,
        )

        request = CodingAgentLaunchRequest(
            prompt="Fix this bug",
            repository=repo_definition_none_branch,
            branch_name="fix-bug-123",
        )

        # Launch the agent
        self.cursor_client.launch(webhook_url=self.webhook_url, request=request)

        # Assert that post was called with correct parameters
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]

        # Verify the payload does NOT contain ref
        payload = call_kwargs["data"]
        assert "ref" not in payload["source"]

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_retries_with_model_on_failure(self, mock_post: Mock, mock_get: Mock) -> None:
        """First attempt fails with 500, retry with fetched model succeeds."""
        mock_post.side_effect = [
            ApiError("Internal Server Error", code=500),
            self._make_success_response(),
        ]
        mock_get.return_value = self._make_models_response(["claude-4-opus", "gpt-4"])

        result = self.cursor_client.launch(
            webhook_url=self.webhook_url, request=self.launch_request
        )

        assert result.id == "agent_123"
        assert mock_post.call_count == 2

        # First call has no model, second call has the first fetched model
        first_call_data = mock_post.call_args_list[0][1]["data"]
        assert "model" not in first_call_data
        second_call_data = mock_post.call_args_list[1][1]["data"]
        assert second_call_data["model"] == "claude-4-opus"

    @patch.object(CursorAgentClient, "post")
    def test_launch_no_retry_on_401(self, mock_post: Mock) -> None:
        """ApiUnauthorized (401) should propagate immediately without retry."""
        mock_post.side_effect = ApiUnauthorized("Unauthorized")

        with pytest.raises(ApiUnauthorized):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "post")
    def test_launch_no_retry_on_403(self, mock_post: Mock) -> None:
        """ApiForbiddenError (403) should propagate immediately without retry."""
        mock_post.side_effect = ApiForbiddenError("Forbidden")

        with pytest.raises(ApiForbiddenError):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "post")
    def test_launch_no_retry_on_429(self, mock_post: Mock) -> None:
        """ApiRateLimitedError (429) should propagate immediately without retry."""
        mock_post.side_effect = ApiRateLimitedError("Rate limited")

        with pytest.raises(ApiRateLimitedError):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_retry_all_models_exhausted(self, mock_post: Mock, mock_get: Mock) -> None:
        """All retries fail, last error is raised."""
        mock_post.side_effect = [
            ApiError("Internal Server Error", code=500),
            ApiError("Bad Gateway", code=502),
            ApiError("Service Unavailable", code=503),
            ApiError("Gateway Timeout", code=504),
        ]
        mock_get.return_value = self._make_models_response(["model-a", "model-b", "model-c"])

        with pytest.raises(ApiError, match="Gateway Timeout"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        # 1 initial + 3 retries
        assert mock_post.call_count == 4

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_retry_get_models_fails(self, mock_post: Mock, mock_get: Mock) -> None:
        """If get_available_models() fails, original error is raised."""
        original_error = ApiError("Internal Server Error", code=500)
        mock_post.side_effect = original_error
        mock_get.side_effect = ApiError("Models endpoint down", code=500)

        with pytest.raises(ApiError, match="Internal Server Error"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_retry_empty_models_list(self, mock_post: Mock, mock_get: Mock) -> None:
        """Empty models list means no retries, original error raised."""
        original_error = ApiError("Internal Server Error", code=500)
        mock_post.side_effect = original_error
        mock_get.return_value = self._make_models_response([])

        with pytest.raises(ApiError, match="Internal Server Error"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_retry_caps_at_max(self, mock_post: Mock, mock_get: Mock) -> None:
        """Only tries first MAX_MODEL_RETRIES (3) models from a longer list."""
        mock_post.side_effect = [
            ApiError("Error", code=500),
            ApiError("Error", code=500),
            ApiError("Error", code=500),
            ApiError("Last Error", code=500),
        ]
        mock_get.return_value = self._make_models_response(
            ["model-1", "model-2", "model-3", "model-4", "model-5"]
        )

        with pytest.raises(ApiError, match="Last Error"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        # 1 initial + 3 retries (not 5)
        assert mock_post.call_count == 4

        # Verify only the first 3 models were tried
        retry_models = [mock_post.call_args_list[i][1]["data"]["model"] for i in range(1, 4)]
        assert retry_models == ["model-1", "model-2", "model-3"]

    @patch.object(CursorAgentClient, "get")
    def test_get_available_models(self, mock_get: Mock) -> None:
        """Test get_available_models() returns the list of model names."""
        mock_get.return_value = self._make_models_response(["claude-4-opus", "gpt-4", "gemini-pro"])

        models = self.cursor_client.get_available_models()

        assert models == ["claude-4-opus", "gpt-4", "gemini-pro"]
        mock_get.assert_called_once()
