from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from sentry import features
from sentry.feedback.usecases.title_generation import (
    GenerateFeedbackTitleRequest,
    get_feedback_title,
    get_feedback_title_from_seer,
    make_seer_request,
    should_get_ai_title,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_should_get_ai_title(default_project):
    """Test the should_get_ai_title function with various feature flag combinations."""
    org = default_project.organization

    def mock_gen_ai_enabled_only(feature_name, *args, **kwargs):
        return feature_name == "organizations:gen-ai-features"

    def mock_feedback_ai_enabled_only(feature_name, *args, **kwargs):
        return feature_name == "organizations:user-feedback-ai-titles"

    # both feature flags disabled
    with patch.object(features, "has", return_value=False):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "gen_ai_disabled"},
            )

    # gen-ai-features enabled
    with patch.object(features, "has", side_effect=mock_gen_ai_enabled_only):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "feedback_ai_titles_disabled"},
            )

    # user-feedback-ai-titles enabled
    with patch.object(features, "has", side_effect=mock_feedback_ai_enabled_only):
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            result = should_get_ai_title(org)
            assert result is False
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.skipped",
                tags={"reason": "gen_ai_disabled"},
            )


@django_db_all
def test_make_seer_request():
    """Test the make_seer_request function with successful and unsuccessful responses."""
    request = GenerateFeedbackTitleRequest(
        organization_id=123, feedback_message="Test feedback message"
    )

    with (
        patch("sentry.feedback.usecases.title_generation.requests.post") as mock_post,
        patch("sentry.feedback.usecases.title_generation.sign_with_seer_secret") as mock_sign,
    ):

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.content = b'{"title": "Test Title"}'
        mock_post.return_value = mock_response

        mock_sign.return_value = {"sentry-seer-signature": "test-signature"}

        result = make_seer_request(request)
        assert result == b'{"title": "Test Title"}'

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[1]["headers"]["content-type"] == "application/json;charset=utf-8"
        assert "sentry-seer-signature" in call_args[1]["headers"]

    with patch("sentry.feedback.usecases.title_generation.requests.post") as mock_post:
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.content = b"Internal Server Error"
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")
        mock_post.return_value = mock_response

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


@django_db_all
def test_get_feedback_title_from_seer():
    """Test the get_feedback_title_from_seer function with various feature flag combinations and Seer call responses."""
    org_id = 123

    # seer call network error
    with patch("sentry.feedback.usecases.title_generation.make_seer_request") as mock_seer:
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            mock_seer.side_effect = Exception("Network error")
            title = get_feedback_title_from_seer("Login button broken", org_id)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error",
            )

    # seer call successful
    with patch("sentry.feedback.usecases.title_generation.make_seer_request") as mock_seer:
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            mock_seer.return_value = b'{"title": "Login Button Issue"}'
            title = get_feedback_title_from_seer("Login button broken", org_id)
            assert title == "User Feedback: Login Button Issue"
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.success",
            )

    # seer call invalid response
    with patch("sentry.feedback.usecases.title_generation.make_seer_request") as mock_seer:
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            mock_seer.return_value = b'{"invalid": "response"}'
            title = get_feedback_title_from_seer("Login button broken", org_id)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )

    # seer call returns empty string
    with patch("sentry.feedback.usecases.title_generation.make_seer_request") as mock_seer:
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            mock_seer.return_value = b'{"title": ""}'
            title = get_feedback_title_from_seer("Login button broken", org_id)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )

    # seer call returns whitespace-only string
    with patch("sentry.feedback.usecases.title_generation.make_seer_request") as mock_seer:
        with patch("sentry.feedback.usecases.title_generation.metrics") as mock_metrics:
            mock_seer.return_value = b'{"title": "   "}'
            title = get_feedback_title_from_seer("Login button broken", org_id)
            assert title is None
            mock_metrics.incr.assert_called_once_with(
                "feedback.ai_title_generation.error", tags={"reason": "invalid_response"}
            )
