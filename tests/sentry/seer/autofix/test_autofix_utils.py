from unittest.mock import Mock, patch

import orjson
import pytest

from sentry.seer.autofix.utils import (
    AutofixTriggerSource,
    get_autofix_prompt,
    get_coding_agent_prompt,
)
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
        mock_response.data = orjson.dumps(self.mock_response_data).encode()
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
        mock_response.data = orjson.dumps(self.mock_response_data).encode()
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
        mock_response.data = orjson.dumps({}).encode()
        mock_make_request.return_value = mock_response

        with pytest.raises(Exception):
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

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_empty_response(self, mock_make_request):
        """Test get_autofix_prompt handles empty prompt in response."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps({"prompt": None}).encode()
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, True)

        assert result is None

    @patch("sentry.seer.autofix.utils.make_signed_seer_api_request")
    def test_get_autofix_prompt_missing_prompt_key(self, mock_make_request):
        """Test get_autofix_prompt handles missing prompt key in response."""
        mock_response = Mock()
        mock_response.status = 200
        mock_response.data = orjson.dumps({"run_id": self.run_id}).encode()
        mock_make_request.return_value = mock_response

        result = get_autofix_prompt(self.run_id, True, True)

        assert result is None

    # Signing is handled inside the request helper now; parameters are validated above.


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
    def test_get_coding_agent_prompt_autofix_prompt_none(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt when autofix prompt is None."""
        mock_get_autofix_prompt.return_value = None

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.SOLUTION)

        assert result is None
        mock_get_autofix_prompt.assert_called_once_with(12345, True, True)

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_root_cause_trigger(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with root_cause trigger."""
        mock_get_autofix_prompt.return_value = "Root cause analysis prompt"

        result = get_coding_agent_prompt(12345, AutofixTriggerSource.ROOT_CAUSE)

        expected = "Please fix the following issue:\n\nRoot cause analysis prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, True, False)
