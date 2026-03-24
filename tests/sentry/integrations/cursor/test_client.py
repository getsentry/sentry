from unittest.mock import Mock, patch

import pytest

from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.cursor.client import (
    CursorAgentClient,
    _extract_failed_model_from_error,
    _get_model_family,
    _prioritize_models_by_family,
)
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
        """Retry fails, retry error is raised."""
        mock_post.side_effect = [
            ApiError("Internal Server Error", code=500),
            ApiError("Bad Gateway", code=502),
        ]
        mock_get.return_value = self._make_models_response(["model-a", "model-b", "model-c"])

        with pytest.raises(ApiError, match="Bad Gateway"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        # 1 initial + 1 retry
        assert mock_post.call_count == 2

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
    def test_get_available_models(self, mock_get: Mock) -> None:
        """Test get_available_models() returns the list of model names."""
        mock_get.return_value = self._make_models_response(["claude-4-opus", "gpt-4", "gemini-pro"])

        models = self.cursor_client.get_available_models()

        assert models == ["claude-4-opus", "gpt-4", "gemini-pro"]
        mock_get.assert_called_once()

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_deprecated_model_retries_same_family_first(
        self, mock_post: Mock, mock_get: Mock
    ) -> None:
        """Deprecated gpt-4 error retries with gpt-family model first."""
        deprecated_error = ApiError("Bad Request", code=400)
        deprecated_error.json = {"error": "Model 'gpt-4' is not available or invalid."}

        mock_post.side_effect = [
            deprecated_error,
            self._make_success_response(),
        ]
        mock_get.return_value = self._make_models_response(
            ["claude-4.6-opus-high-thinking", "composer-1.5", "gpt-5.3-codex-high"]
        )

        result = self.cursor_client.launch(
            webhook_url=self.webhook_url, request=self.launch_request
        )

        assert result.id == "agent_123"
        assert mock_post.call_count == 2
        # Should retry with gpt-family model first, not claude or composer
        retry_model = mock_post.call_args_list[1][1]["data"]["model"]
        assert retry_model == "gpt-5.3-codex-high"

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_non_model_500_error_preserves_original_order(
        self, mock_post: Mock, mock_get: Mock
    ) -> None:
        """Non-model 500 error still retries, preserving original model order."""
        mock_post.side_effect = [
            ApiError("Internal Server Error", code=500),
            self._make_success_response(),
        ]
        mock_get.return_value = self._make_models_response(
            ["claude-4.6-opus", "gpt-5.3-codex-high", "composer-1.5"]
        )

        result = self.cursor_client.launch(
            webhook_url=self.webhook_url, request=self.launch_request
        )

        assert result.id == "agent_123"
        # Original order preserved since error doesn't identify a model
        retry_model = mock_post.call_args_list[1][1]["data"]["model"]
        assert retry_model == "claude-4.6-opus"

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_non_model_400_error_does_not_retry(
        self, mock_post: Mock, mock_get: Mock
    ) -> None:
        """A 400 error not about models (e.g., invalid branch name) raises immediately."""
        bad_request = ApiError("Bad Request", code=400)
        bad_request.json = {"error": "Invalid branch name."}
        mock_post.side_effect = bad_request
        mock_get.return_value = self._make_models_response(
            ["claude-4.6-opus", "gpt-5.3-codex-high"]
        )

        with pytest.raises(ApiError, match="Bad Request"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        # Only the initial attempt, no model retries
        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_non_json_400_error_does_not_retry(
        self, mock_post: Mock, mock_get: Mock
    ) -> None:
        """A 400 error without JSON body raises immediately without retrying."""
        bad_request = ApiError("Bad Request", code=400)
        bad_request.json = None
        mock_post.side_effect = bad_request
        mock_get.return_value = self._make_models_response(
            ["claude-4.6-opus", "gpt-5.3-codex-high"]
        )

        with pytest.raises(ApiError, match="Bad Request"):
            self.cursor_client.launch(webhook_url=self.webhook_url, request=self.launch_request)

        assert mock_post.call_count == 1

    @patch.object(CursorAgentClient, "get")
    @patch.object(CursorAgentClient, "post")
    def test_launch_deprecated_gemini_retries_gpt_before_claude(
        self, mock_post: Mock, mock_get: Mock
    ) -> None:
        """Deprecated gemini model with no gemini available retries GPT models first."""
        deprecated_error = ApiError("Bad Request", code=400)
        deprecated_error.json = {"error": "Model 'gemini-2.0-flash' is not available or invalid."}

        mock_post.side_effect = [
            deprecated_error,
            self._make_success_response(),
        ]
        mock_get.return_value = self._make_models_response(
            ["claude-4.6-opus-high-thinking", "composer-1.5", "gpt-5.3-codex-high"]
        )

        result = self.cursor_client.launch(
            webhook_url=self.webhook_url, request=self.launch_request
        )

        assert result.id == "agent_123"
        assert mock_post.call_count == 2
        # No gemini models available, so GPT should be tried before claude/composer
        retry_model = mock_post.call_args_list[1][1]["data"]["model"]
        assert retry_model == "gpt-5.3-codex-high"


class GetModelFamilyTest(TestCase):
    def test_gpt_family(self) -> None:
        assert _get_model_family("gpt-4") == "gpt"
        assert _get_model_family("gpt-5.3-codex-high") == "gpt"

    def test_claude_family(self) -> None:
        assert _get_model_family("claude-4.6-opus-high-thinking") == "claude"
        assert _get_model_family("claude-3.5-sonnet") == "claude"

    def test_gemini_family(self) -> None:
        assert _get_model_family("gemini-2.0-flash") == "gemini"

    def test_composer_family(self) -> None:
        assert _get_model_family("composer-1.5") == "composer"

    def test_unknown_no_version(self) -> None:
        assert _get_model_family("custom-model") == "custom-model"

    def test_single_word_with_version(self) -> None:
        assert _get_model_family("llama3.1") == "llama"


class ExtractFailedModelFromErrorTest(TestCase):
    def test_model_error(self) -> None:
        error = ApiError("Bad Request", code=400)
        error.json = {"error": "Model 'gpt-4' is not available or invalid."}
        assert _extract_failed_model_from_error(error) == "gpt-4"

    def test_non_model_error(self) -> None:
        error = ApiError("Internal Server Error", code=500)
        error.json = {"error": "Something went wrong."}
        assert _extract_failed_model_from_error(error) is None

    def test_non_json_error(self) -> None:
        error = ApiError("Internal Server Error", code=500)
        error.json = None
        assert _extract_failed_model_from_error(error) is None

    def test_missing_error_key(self) -> None:
        error = ApiError("Bad Request", code=400)
        error.json = {"message": "Something went wrong."}
        assert _extract_failed_model_from_error(error) is None

    def test_no_json_attribute(self) -> None:
        error = ApiError("Internal Server Error", code=500)
        # ApiError without json attribute set
        if hasattr(error, "json"):
            del error.json
        assert _extract_failed_model_from_error(error) is None

    def test_non_string_error_value(self) -> None:
        error = ApiError("Bad Request", code=400)
        error.json = {"error": 42}
        assert _extract_failed_model_from_error(error) is None

    def test_dict_error_value(self) -> None:
        error = ApiError("Bad Request", code=400)
        error.json = {"error": {"code": "model_not_found", "model": "gpt-4"}}
        assert _extract_failed_model_from_error(error) is None


class PrioritizeModelsByFamilyTest(TestCase):
    def test_same_family_first(self) -> None:
        models = ["claude-4.6-opus", "gpt-5.3-codex-high", "composer-1.5", "gpt-4.1"]
        result = _prioritize_models_by_family(models, "gpt-4")
        # Same-family (gpt) first, then remaining in original relative order
        assert result == ["gpt-5.3-codex-high", "gpt-4.1", "claude-4.6-opus", "composer-1.5"]

    def test_gpt_fallback_when_no_same_family(self) -> None:
        """When no same-family models exist, GPT models come before other families."""
        models = ["claude-4.6-opus", "gpt-5.3-codex-high", "composer-1.5", "gpt-4.1"]
        result = _prioritize_models_by_family(models, "gemini-2.0-flash")
        assert result == ["gpt-5.3-codex-high", "gpt-4.1", "claude-4.6-opus", "composer-1.5"]

    def test_gpt_fallback_after_same_family(self) -> None:
        """Same-family models come first, then GPT, then the rest."""
        models = ["gpt-5.3-codex-high", "claude-4.6-opus", "claude-3.5-sonnet", "composer-1.5"]
        result = _prioritize_models_by_family(models, "claude-4-opus")
        assert result == [
            "claude-4.6-opus",
            "claude-3.5-sonnet",
            "gpt-5.3-codex-high",
            "composer-1.5",
        ]

    def test_no_failed_model_preserves_order(self) -> None:
        models = ["claude-4.6-opus", "gpt-5.3-codex-high", "composer-1.5"]
        result = _prioritize_models_by_family(models, None)
        assert result == ["claude-4.6-opus", "gpt-5.3-codex-high", "composer-1.5"]

    def test_no_matching_family(self) -> None:
        models = ["claude-4.6-opus", "composer-1.5"]
        result = _prioritize_models_by_family(models, "gemini-2.0-flash")
        assert result == ["claude-4.6-opus", "composer-1.5"]

    def test_no_matching_family_with_gpt_available(self) -> None:
        models = ["claude-4.6-opus", "gpt-4.1", "composer-1.5"]
        result = _prioritize_models_by_family(models, "gemini-2.0-flash")
        assert result == ["gpt-4.1", "claude-4.6-opus", "composer-1.5"]

    def test_all_same_family(self) -> None:
        models = ["gpt-5.3-codex-high", "gpt-4.1", "gpt-3.5-turbo"]
        result = _prioritize_models_by_family(models, "gpt-4")
        assert result == ["gpt-5.3-codex-high", "gpt-4.1", "gpt-3.5-turbo"]
