from typing import int
from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import (
    AutofixState,
    AutofixTriggerSource,
    CodingAgentStatus,
    get_autofix_prompt,
    get_coding_agent_prompt,
)
from sentry.seer.models import SeerApiError
from sentry.testutils.cases import TestCase


class TestGetAutofixPrompt(TestCase):
    def setUp(self):
        super().setUp()
        self.run_id = 12345
        self.mock_response_data = {
            "run_id": self.run_id,
            "prompt": "Test prompt content",
            "has_root_cause": True,
            "has_solution": True,
        }

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_root_cause_params(self, mock_make_request):
        """Test get_autofix_prompt sends correct params for root cause."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(self.mock_response_data)
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, False)

        assert result == "Test prompt content"

        mock_make_request.assert_called_once()
        call = mock_make_request.call_args
        # Positional args: (connection_pool, path)
        assert call.args[0] is not None
        assert call.args[1] == "/v1/automation/autofix/prompt"

        # Keyword args
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": False,
        }
        actual_body = orjson.loads(call.kwargs["body"])  # bytes -> dict
        assert actual_body == expected_body
        assert call.kwargs["timeout"] == 15

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_solution_params(self, mock_make_request):
        """Test get_autofix_prompt sends correct params for solution."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps(self.mock_response_data)
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, True)

        assert result == "Test prompt content"

        call = mock_make_request.call_args
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": True,
        }
        actual_body = orjson.loads(call.kwargs["body"])  # bytes -> dict
        assert actual_body == expected_body

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_http_error_raises(self, mock_make_request):
        """Test get_autofix_prompt raises on HTTP error status."""
        mock_response = Mock()
        mock_response.status = 404
        mock_response.data = orjson.dumps({})
        mock_make_request.return_value = mock_response

        with pytest.raises(SeerApiError):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_timeout_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates timeout errors."""
        mock_make_request.side_effect = Exception("Request timed out")

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_connection_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates connection errors."""
        mock_make_request.side_effect = Exception("Connection failed")

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_json_decode_error_raises(self, mock_make_request):
        """Test get_autofix_prompt propagates JSON decode errors."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = b"invalid orjson"
        mock_make_request.return_value = mock_response

        with pytest.raises(Exception):
            get_autofix_prompt(self.run_id, True, True)


class TestGetCodingAgentPrompt(TestCase):
    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_success(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with successful autofix prompt."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION)

        expected = "Please fix the following issue:\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_root_cause_trigger(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with root_cause trigger."""
        mock_get_autofix_prompt.return_value = "Root cause analysis prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.ROOT_CAUSE)

        expected = "Please fix the following issue:\n\nRoot cause analysis prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, False)


class TestAutofixStateParsing(TestCase):
    def test_autofix_state_validate_parses_nested_structures(self):
        state_data = {
            "run_id": 1,
            "request": {
                "project_id": 42,
                "organization_id": 123,
                "issue": {"id": 999, "title": "Something broke"},
                "repos": [
                    {
                        "provider": "github",
                        "owner": "getsentry",
                        "name": "sentry",
                        "external_id": "123",
                    }
                ],
            },
            "updated_at": "2025-08-25T12:34:56.000Z",
            "status": "PROCESSING",
            "codebases": {
                "123": {
                    "repo_external_id": "123",
                    "file_changes": [],
                    "is_readable": True,
                    "is_writeable": False,
                }
            },
            "steps": [{"key": "root_cause_analysis", "id": "rca"}],
            "coding_agents": {
                "agent-1": {
                    "id": "agent-1",
                    "status": "completed",
                    "name": "Autofixer",
                    "provider": "cursor_background_agent",
                    "started_at": "2025-08-25T12:00:00.000Z",
                    "results": [],
                }
            },
        }

        state = AutofixState.validate(state_data)

        # Check that stuff is parsed
        assert state.run_id == 1
        assert state.status == AutofixStatus.PROCESSING

        codebase = state.codebases["123"]
        assert codebase.repo_external_id == "123"

        # Top-level coding_agents map is parsed with enum status
        assert state.coding_agents["agent-1"].status == CodingAgentStatus.COMPLETED
