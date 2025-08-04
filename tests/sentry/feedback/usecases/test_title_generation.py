from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
import responses
from django.conf import settings

from sentry.feedback.usecases.title_generation import (
    GenerateFeedbackTitleRequest,
    get_feedback_title,
    get_feedback_title_from_seer,
    make_seer_request,
    should_get_ai_title,
)
from sentry.models.organization import Organization
from sentry.testutils.helpers.features import Feature


def mock_seer_response(**kwargs) -> None:
    """Use with @responses.activate to mock Seer API responses."""
    responses.add(
        responses.POST,
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title",
        **kwargs,
    )


def test_should_get_ai_title():
    """Test the should_get_ai_title function with various feature flag combinations."""
    org = Mock(spec=Organization)
    org.id = 123
    org.slug = "test-org"

    # both feature flags disabled
    with Feature(
        {"organizations:gen-ai-features": False, "organizations:user-feedback-ai-titles": False}
    ):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "gen_ai_disabled"},
            )

    # gen-ai-features enabled, user-feedback-ai-titles disabled
    with Feature(
        {"organizations:gen-ai-features": True, "organizations:user-feedback-ai-titles": False}
    ):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "feedback_ai_titles_disabled"},
            )

    # gen-ai-features disabled, user-feedback-ai-titles enabled
    with Feature(
        {"organizations:gen-ai-features": False, "organizations:user-feedback-ai-titles": True}
    ):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "gen_ai_disabled"},
            )

    # both feature flags enabled
    with Feature(
        {"organizations:gen-ai-features": True, "organizations:user-feedback-ai-titles": True}
    ):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is True
            mock_metrics.incr.assert_not_called()


@responses.activate
def test_make_seer_request():
    """Test the make_seer_request function with successful response."""
    request = GenerateFeedbackTitleRequest(
        organization_id=123, feedback_message="Test feedback message"
    )

    mock_seer_response(
        status=200,
        json={"title": "Test Title"},
    )

    with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
        mock_sign.return_value = {"sentry-seer-signature": "test-signature"}

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
        assert "sentry-seer-signature" in seer_request.headers

        # Verify sign_with_seer_secret was called with the correct encoded data
        mock_sign.assert_called_once()
        call_args = mock_sign.call_args[0][0]  # First positional argument
        assert isinstance(call_args, bytes)
        # The encoded data should contain the request data
        assert b"123" in call_args  # organization_id
        assert b"Test feedback message" in call_args  # feedback_message


@responses.activate
def test_make_seer_request_http_error():
    """Test the make_seer_request function with HTTP error."""
    request = GenerateFeedbackTitleRequest(
        organization_id=123, feedback_message="Test feedback message"
    )

    mock_seer_response(status=500, body="Internal Server Error")

    with pytest.raises(Exception):  # requests.HTTPError
        make_seer_request(request)


def test_get_feedback_title() -> None:
    """Test the get_feedback_title function with various message types."""

    # Test normal short message
    assert get_feedback_title("Login button broken") == "User Feedback: Login button broken"

    # Test message with exactly 10 words (default max_words)
    message_10_words = "This is a test message with exactly ten words total"
    assert get_feedback_title(message_10_words) == f"User Feedback: {message_10_words}"

    # Test message with more than 10 words (should truncate)
    long_message = "This is a very long feedback message that goes on and on and describes many different issues"
    expected = "User Feedback: This is a very long feedback message that goes on..."
    assert get_feedback_title(long_message) == expected

    # Test very short message
    assert get_feedback_title("Bug") == "User Feedback: Bug"

    # Test custom max_words parameter
    message = "This is a test with custom word limit"
    assert get_feedback_title(message, max_words=3) == "User Feedback: This is a..."

    # Test message that would create a title longer than 200 characters
    very_long_message = "a" * 300  # 300 character message
    result = get_feedback_title(very_long_message)
    assert len(result) <= 200
    assert result.endswith("...")
    assert result.startswith("User Feedback: ")

    # Test message with special characters
    special_message = "The @login button doesn't work! It's broken & needs fixing."
    expected_special = "User Feedback: The @login button doesn't work! It's broken & needs fixing."
    assert get_feedback_title(special_message) == expected_special


@responses.activate
def test_get_feedback_title_from_seer_network_error():
    """Test the get_feedback_title_from_seer function with network error."""
    mock_seer_response(body=Exception("Network error"))

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        title = get_feedback_title_from_seer("Login button broken", 123)
        assert title is None
        mock_metrics.incr.assert_called_once_with(
            "feedback.ai_title_generation.error",
        )


@responses.activate
def test_get_feedback_title_from_seer_success():
    """Test the get_feedback_title_from_seer function with successful response."""
    mock_seer_response(
        status=200,
        body='{"title": "Login Button Issue"}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title == "User Feedback: Login Button Issue"
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.success",
            )


@responses.activate
def test_get_feedback_title_from_seer_invalid_response():
    """Test the get_feedback_title_from_seer function with invalid response."""
    mock_seer_response(
        status=200,
        body='{"invalid": "response"}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )


@responses.activate
def test_get_feedback_title_from_seer_empty_title():
    """Test the get_feedback_title_from_seer function with empty title."""
    mock_seer_response(
        status=200,
        body='{"title": ""}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )


@responses.activate
def test_get_feedback_title_from_seer_whitespace_title():
    """Test the get_feedback_title_from_seer function with whitespace title."""
    mock_seer_response(
        status=200,
        body='{"title": "   "}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )


@responses.activate
def test_get_feedback_title_from_seer_non_string_title():
    """Test the get_feedback_title_from_seer function with non-string title."""
    mock_seer_response(
        status=200,
        body='{"title": 123}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )


@responses.activate
def test_get_feedback_title_from_seer_json_decode_error():
    """Test the get_feedback_title_from_seer function with invalid JSON response."""
    mock_seer_response(
        status=200,
        body='{"invalid": json}',
    )

    with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
        with patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign:
            mock_sign.return_value = {"sentry-seer-signature": "test-signature"}
            title = get_feedback_title_from_seer("Login button broken", 123)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error",
            )
