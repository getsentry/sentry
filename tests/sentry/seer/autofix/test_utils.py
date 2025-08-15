from unittest.mock import Mock, patch

import orjson
import requests

from sentry.seer.autofix.utils import get_autofix_prompt, get_coding_agent_prompt
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

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_root_cause_trigger(self, mock_settings, mock_post):
        """Test get_autofix_prompt with root_cause trigger source."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = self.mock_response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "root_cause")

        assert result == "Test prompt content"

        # Verify the request was made correctly
        mock_post.assert_called_once()
        call_args = mock_post.call_args

        # Check URL
        assert call_args[0][0] == "https://seer.test.com/v1/automation/autofix/prompt"

        # Check request body
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": False,
        }
        actual_body = orjson.loads(call_args[1]["data"])
        assert actual_body == expected_body

        # Check headers
        assert call_args[1]["headers"]["content-type"] == "application/json;charset=utf-8"
        assert call_args[1]["timeout"] == 30

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_solution_trigger(self, mock_settings, mock_post):
        """Test get_autofix_prompt with solution trigger source."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = self.mock_response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result == "Test prompt content"

        # Check request body for solution trigger
        call_args = mock_post.call_args
        expected_body = {
            "run_id": self.run_id,
            "include_root_cause": True,
            "include_solution": True,
        }
        actual_body = orjson.loads(call_args[1]["data"])
        assert actual_body == expected_body

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_http_error(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles HTTP errors."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_timeout_error(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles timeout errors."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_post.side_effect = requests.Timeout("Request timed out")

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_connection_error(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles connection errors."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_post.side_effect = requests.ConnectionError("Connection failed")

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_json_decode_error(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles JSON decode errors."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_empty_response(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles empty prompt in response."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"prompt": None}
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    def test_get_autofix_prompt_missing_prompt_key(self, mock_settings, mock_post):
        """Test get_autofix_prompt handles missing prompt key in response."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"run_id": self.run_id}
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result is None

    @patch("sentry.seer.autofix.utils.requests.post")
    @patch("sentry.seer.autofix.utils.settings")
    @patch("sentry.seer.autofix.utils.sign_with_seer_secret")
    def test_get_autofix_prompt_uses_seer_secret(self, mock_sign, mock_settings, mock_post):
        """Test get_autofix_prompt uses Seer secret signing."""
        mock_settings.SEER_AUTOFIX_URL = "https://seer.test.com"
        mock_sign.return_value = {"Authorization": "Bearer test-token"}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = self.mock_response_data
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        result = get_autofix_prompt(self.run_id, "solution")

        assert result == "Test prompt content"

        # Verify signing was called
        mock_sign.assert_called_once()

        # Verify signed headers were included
        call_args = mock_post.call_args
        headers = call_args[1]["headers"]
        assert "Authorization" in headers
        assert headers["Authorization"] == "Bearer test-token"


class TestGetCodingAgentPrompt(TestCase):
    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_success(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with successful autofix prompt."""
        mock_get_autofix_prompt.return_value = "This is the autofix prompt"

        result = get_coding_agent_prompt(12345, "solution")

        expected = "Please fix the following issue:\n\nThis is the autofix prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, "solution")

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_autofix_prompt_none(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt when autofix prompt is None."""
        mock_get_autofix_prompt.return_value = None

        result = get_coding_agent_prompt(12345, "solution")

        assert result is None
        mock_get_autofix_prompt.assert_called_once_with(12345, "solution")

    @patch("sentry.seer.autofix.utils.get_autofix_prompt")
    def test_get_coding_agent_prompt_root_cause_trigger(self, mock_get_autofix_prompt):
        """Test get_coding_agent_prompt with root_cause trigger."""
        mock_get_autofix_prompt.return_value = "Root cause analysis prompt"

        result = get_coding_agent_prompt(12345, "root_cause")

        expected = "Please fix the following issue:\n\nRoot cause analysis prompt"
        assert result == expected
        mock_get_autofix_prompt.assert_called_once_with(12345, "root_cause")
