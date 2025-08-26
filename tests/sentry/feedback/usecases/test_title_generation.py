from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.feedback.usecases.title_generation import (
    format_feedback_title,
    get_feedback_title_from_seer,
)
from tests.sentry.feedback import MockSeerResponse


@pytest.mark.parametrize(
    "status_code,json_data",
    [
        pytest.param(
            200,
            {"invalid": "response"},
            id="missing_title_key",
        ),
        pytest.param(
            200,
            {"title": ""},
            id="empty_title",
        ),
        pytest.param(
            200,
            {"title": "   "},
            id="whitespace_only_title",
        ),
        pytest.param(
            200,
            {"title": 123},
            id="non_string_title",
        ),
        pytest.param(
            200,
            {},
            id="invalid_json",
        ),
    ],
)
@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_invalid_response(
    mock_make_seer_request, status_code, json_data
):
    """Test the get_feedback_title_from_seer function with various invalid responses."""
    mock_response = MockSeerResponse(status_code, json_data)
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None
    mock_make_seer_request.assert_called_once()


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_http_error(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with HTTP error response."""
    mock_response = MockSeerResponse(500, {})
    mock_make_seer_request.return_value = mock_response
    assert get_feedback_title_from_seer("Login button broken", 123) is None
    mock_make_seer_request.assert_called_once()


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_exception(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with exception during API call."""
    mock_make_seer_request.side_effect = Exception("Network error")
    assert get_feedback_title_from_seer("Login button broken", 123) is None
    mock_make_seer_request.assert_called_once()


@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_get_feedback_title_from_seer_success(mock_make_seer_request):
    """Test the get_feedback_title_from_seer function with successful response."""
    mock_response = MockSeerResponse(200, {"title": "Login Button Issue"})
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
