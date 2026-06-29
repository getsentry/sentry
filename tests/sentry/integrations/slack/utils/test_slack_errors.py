from unittest.mock import MagicMock, patch

import pytest
from slack_sdk.errors import SlackApiError, SlackRequestError
from slack_sdk.web import SlackResponse

from sentry.integrations.slack.utils.errors import (
    CHANNEL_NOT_FOUND,
    FATAL_ERROR,
    INTERNAL_ERROR,
    INVALID_ATTACHMENTS,
    INVALID_AUTH,
    INVALID_BLOCKS,
    NON_JSON_RESPONSE,
    RATE_LIMITED,
    SLACK_SDK_ERROR_CATEGORIES,
    SLACK_SDK_HALT_ERROR_CATEGORIES,
    unpack_slack_api_error,
)


def _make_slack_api_error(error: str) -> SlackApiError:
    response = SlackResponse(
        client=MagicMock(),
        http_verb="POST",
        api_url="https://slack.com/api/chat.postMessage",
        req_args={},
        data={"ok": False, "error": error},
        headers={},
        status_code=200,
    )
    return SlackApiError(
        message=f"The request to the Slack API failed. (error: {error})", response=response
    )


class TestUnpackSlackApiError:
    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_fatal_error(self, mock_capture):
        exc = _make_slack_api_error("fatal_error")
        result = unpack_slack_api_error(exc)
        assert result is FATAL_ERROR
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_internal_error(self, mock_capture):
        exc = _make_slack_api_error("internal_error")
        result = unpack_slack_api_error(exc)
        assert result is INTERNAL_ERROR
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_invalid_blocks(self, mock_capture):
        exc = _make_slack_api_error("invalid_blocks")
        result = unpack_slack_api_error(exc)
        assert result is INVALID_BLOCKS
        assert result not in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_invalid_attachments(self, mock_capture):
        exc = _make_slack_api_error("invalid_attachments")
        result = unpack_slack_api_error(exc)
        assert result is INVALID_ATTACHMENTS
        assert result not in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_invalid_auth(self, mock_capture):
        exc = _make_slack_api_error("invalid_auth")
        result = unpack_slack_api_error(exc)
        assert result is INVALID_AUTH
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_non_json_response(self, mock_capture):
        response = SlackResponse(
            client=MagicMock(),
            http_verb="POST",
            api_url="https://slack.com/api/chat.postMessage",
            req_args={},
            data={
                "ok": False,
                "error": "Received a response in a non-JSON format: <!DOCTYPE html>...",
            },
            headers={},
            status_code=200,
        )
        exc = SlackApiError(message="The request to the Slack API failed.", response=response)
        result = unpack_slack_api_error(exc)
        assert result is NON_JSON_RESPONSE
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_preexisting_category_channel_not_found(self, mock_capture):
        exc = _make_slack_api_error("channel_not_found")
        result = unpack_slack_api_error(exc)
        assert result is CHANNEL_NOT_FOUND
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_preexisting_category_ratelimited(self, mock_capture):
        exc = _make_slack_api_error("ratelimited")
        result = unpack_slack_api_error(exc)
        assert result is RATE_LIMITED
        assert result in SLACK_SDK_HALT_ERROR_CATEGORIES
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_all_categories_recognized(self, mock_capture):
        for category in SLACK_SDK_ERROR_CATEGORIES:
            if category is NON_JSON_RESPONSE:
                continue
            exc = _make_slack_api_error(category.message)
            result = unpack_slack_api_error(exc)
            assert result is category, f"Expected {category.message} to be recognized"
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_slack_request_error_string_fallback(self, mock_capture):
        exc = SlackRequestError("channel_not_found\nsome extra detail")
        result = unpack_slack_api_error(exc)
        assert result is CHANNEL_NOT_FOUND
        mock_capture.assert_not_called()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_slack_request_error_unknown(self, mock_capture):
        exc = SlackRequestError("something_completely_new")
        result = unpack_slack_api_error(exc)
        assert result is None
        mock_capture.assert_called_once()

    @patch("sentry.integrations.slack.utils.errors.capture_message")
    def test_unknown_error_fires_capture_message(self, mock_capture):
        exc = _make_slack_api_error("totally_new_error")
        result = unpack_slack_api_error(exc)
        assert result is None
        mock_capture.assert_called_once()

    @pytest.mark.parametrize(
        "category,expected_halt",
        [
            (FATAL_ERROR, True),
            (INTERNAL_ERROR, True),
            (INVALID_BLOCKS, False),
            (INVALID_ATTACHMENTS, False),
            (INVALID_AUTH, True),
            (NON_JSON_RESPONSE, True),
        ],
    )
    def test_halt_classification(self, category, expected_halt):
        if expected_halt:
            assert category in SLACK_SDK_HALT_ERROR_CATEGORIES
        else:
            assert category not in SLACK_SDK_HALT_ERROR_CATEGORIES
