from __future__ import annotations

from unittest.mock import Mock, patch

from sentry.feedback.usecases.title_generation import (
    format_feedback_title,
    get_feedback_title_from_seer,
    should_get_ai_title,
)
from sentry.models.organization import Organization
from sentry.testutils.helpers.features import Feature


class MockResponse:
    """Mock response object for testing."""

    def __init__(self, status: int, json_data: dict, raw_data: str | bytes):
        self.status = status
        self.json_data = json_data
        self.data = raw_data

    def json(self):
        return self.json_data


def test_should_get_ai_title():
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


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_missing_title_key(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with missing title key in response."""
    mock_response = MockResponse(200, {"invalid": "response"}, '{"invalid": "response"}')
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_empty_title(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with empty title in response."""
    mock_response = MockResponse(200, {"title": ""}, '{"title": ""}')
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_whitespace_only_title(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with whitespace-only title in response."""
    mock_response = MockResponse(200, {"title": "   "}, '{"title": "   "}')
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_non_string_title(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with non-string title in response."""
    mock_response = MockResponse(200, {"title": 123}, '{"title": 123}')
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_invalid_json(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with invalid JSON response."""
    mock_response = MockResponse(200, {}, '{"invalid": json}')
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_http_error(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with HTTP error response."""
    mock_response = MockResponse(500, {}, "Internal Server Error")
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_exception(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with exception during API call."""
    mock_make_seer_request.side_effect = Exception("Network error")
    assert get_feedback_title_from_seer("Login button broken", 123) is None


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_success(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with successful response."""
    mock_response = MockResponse(
        200, {"title": "Login Button Issue"}, '{"title": "Login Button Issue"}'
    )
    mock_make_seer_request.return_value = mock_response
    assert "Login Button Issue" == get_feedback_title_from_seer("Login button broken", 123)
    mock_make_seer_request.assert_called_once()


def test_format_feedback_title() -> None:
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
    expected_special = "User Feedback: The @login button doesn't work! It's broken & needs fixing."
    assert format_feedback_title(special_message) == expected_special
