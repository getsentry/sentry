from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
import responses
from django.conf import settings

from sentry.feedback.usecases.title_generation import (
    GenerateFeedbackTitleRequest,
    format_feedback_title,
    get_feedback_title_from_seer,
    make_seer_request,
    should_get_ai_title,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import Feature


def mock_seer_response(**kwargs) -> None:
    """Use with @responses.activate to mock Seer API responses."""
    responses.add(
        responses.POST,
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title",
        **kwargs,
    )


class TestTitleGeneration(TestCase):
    def test_should_get_ai_title(self):
        """Test the should_get_ai_title function with various feature flag combinations."""
        org = Mock(spec=Organization)
        org.id = 123
        org.slug = "test-org"

        # both feature flags disabled
        with Feature(
            {"organizations:gen-ai-features": False, "organizations:user-feedback-ai-titles": False}
        ):
            assert should_get_ai_title(org) is False

        # gen-ai-features enabled, user-feedback-ai-titles disabled
        with Feature(
            {"organizations:gen-ai-features": True, "organizations:user-feedback-ai-titles": False}
        ):
            assert should_get_ai_title(org) is False

        # gen-ai-features disabled, user-feedback-ai-titles enabled
        with Feature(
            {"organizations:gen-ai-features": False, "organizations:user-feedback-ai-titles": True}
        ):
            assert should_get_ai_title(org) is False

        # both feature flags enabled
        with Feature(
            {"organizations:gen-ai-features": True, "organizations:user-feedback-ai-titles": True}
        ):
            assert should_get_ai_title(org) is True

    @responses.activate
    def test_make_seer_request(self):
        """Test the make_seer_request function with successful response."""
        request = GenerateFeedbackTitleRequest(
            organization_id=123, feedback_message="Test feedback message"
        )

        mock_seer_response(
            status=200,
            json={"title": "Test Title"},
        )

        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {}

            result = make_seer_request(request)
            assert result == b'{"title": "Test Title"}'

            assert len(responses.calls) == 1
            seer_request = responses.calls[0].request
            assert (
                seer_request.url
                == f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title"
            )
            assert seer_request.method == "POST"
            assert seer_request.headers["content-type"] == "application/json;charset=utf-8"

            # verify sign_with_seer_secret was called with the correct encoded data
            mock_sign.assert_called_once()
            call_args = mock_sign.call_args[0][0]
            assert isinstance(call_args, bytes)
            assert b"123" in call_args
            assert b"Test feedback message" in call_args

    @responses.activate
    def test_make_seer_request_http_error(self):
        """Test the make_seer_request function with HTTP error."""
        request = GenerateFeedbackTitleRequest(
            organization_id=123, feedback_message="Test feedback message"
        )

        mock_seer_response(status=500, body="Internal Server Error")

        with pytest.raises(Exception):  # requests.HTTPError
            make_seer_request(request)

    def test_format_feedback_title(self) -> None:
        """Test the format_feedback_title function with various message types."""

        # Test normal short message
        assert format_feedback_title("Login button broken") == "User Feedback: Login button broken"

        # Test message with exactly 10 words (default max_words)
        message_10_words = "This is a test message with exactly ten words total"
        assert format_feedback_title(message_10_words) == f"User Feedback: {message_10_words}"

        # Test message with more than 10 words (should truncate)
        long_message = "This is a very long feedback message that goes on and on and describes many different issues"
        expected = "User Feedback: This is a very long feedback message that goes on..."
        assert format_feedback_title(long_message) == expected

        # Test very short message
        assert format_feedback_title("Bug") == "User Feedback: Bug"

        # Test custom max_words parameter
        message = "This is a test with custom word limit"
        assert format_feedback_title(message, max_words=3) == "User Feedback: This is a..."

        # Test message that would create a title longer than 200 characters
        very_long_message = "a" * 300  # 300 character message
        result = format_feedback_title(very_long_message)
        assert len(result) <= 200
        assert result.endswith("...")
        assert result.startswith("User Feedback: ")

        # Test message with special characters
        special_message = "The @login button doesn't work! It's broken & needs fixing."
        expected_special = (
            "User Feedback: The @login button doesn't work! It's broken & needs fixing."
        )
        assert format_feedback_title(special_message) == expected_special

    @responses.activate
    def test_get_feedback_title_from_seer_missing_title_key(self):
        """Test the get_feedback_title_from_seer function with missing title key in response."""
        mock_seer_response(
            status=200,
            body='{"invalid": "response"}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_empty_title(self):
        """Test the get_feedback_title_from_seer function with empty title in response."""
        mock_seer_response(
            status=200,
            body='{"title": ""}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_whitespace_only_title(self):
        """Test the get_feedback_title_from_seer function with whitespace-only title in response."""
        mock_seer_response(
            status=200,
            body='{"title": "   "}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_non_string_title(self):
        """Test the get_feedback_title_from_seer function with non-string title in response."""
        mock_seer_response(
            status=200,
            body='{"title": 123}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_invalid_json(self):
        """Test the get_feedback_title_from_seer function with invalid JSON response."""
        mock_seer_response(
            status=200,
            body='{"invalid": json}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_http_error(self):
        """Test the get_feedback_title_from_seer function with HTTP error response."""
        mock_seer_response(
            status=500,
            body="Internal Server Error",
        )
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_network_error(self):
        """Test the get_feedback_title_from_seer function with network error."""
        mock_seer_response(body=Exception("Network error"))
        assert get_feedback_title_from_seer("Login button broken", 123) is None

    @responses.activate
    def test_get_feedback_title_from_seer_success(self):
        """Test the get_feedback_title_from_seer function with successful response."""
        mock_seer_response(
            status=200,
            body='{"title": "Login Button Issue"}',
        )
        assert get_feedback_title_from_seer("Login button broken", 123) == "Login Button Issue"
