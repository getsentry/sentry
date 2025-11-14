from typing import int
from unittest.mock import patch

import pytest

from sentry.feedback.usecases.spam_detection import is_spam_seer
from tests.sentry.feedback import MockSeerResponse


@pytest.mark.parametrize("response_is_spam", [True, False])
@patch("sentry.feedback.usecases.spam_detection.make_signed_seer_api_request")
def test_is_spam_seer_success(mock_make_seer_request, response_is_spam):
    mock_make_seer_request.return_value = MockSeerResponse(200, {"is_spam": response_is_spam})
    if response_is_spam:
        assert is_spam_seer("Test feedback message", 1) is True
    else:
        assert is_spam_seer("Test feedback message", 1) is False
    mock_make_seer_request.assert_called_once()


@patch("sentry.feedback.usecases.spam_detection.make_signed_seer_api_request")
def test_is_spam_seer_exception(mock_make_seer_request):
    mock_make_seer_request.side_effect = Exception("Network error")
    assert is_spam_seer("Test feedback message", 1) is None
    mock_make_seer_request.assert_called_once()


@pytest.mark.parametrize("status_code", [400, 401, 403, 404, 429, 500, 502, 503, 504])
@patch("sentry.feedback.usecases.spam_detection.make_signed_seer_api_request")
def test_is_spam_seer_http_error(mock_make_seer_request, status_code):
    mock_make_seer_request.return_value = MockSeerResponse(status_code, {})
    assert is_spam_seer("Test feedback message", 1) is None
    mock_make_seer_request.assert_called_once()


@pytest.mark.parametrize(
    "invalid_response",
    [
        pytest.param({"wrong_key": True}, id="missing_is_spam_key"),
        pytest.param({"is_spam": "invalid"}, id="string_instead_of_bool"),
        pytest.param({"is_spam": 123}, id="int_instead_of_bool"),
        pytest.param({"is_spam": None}, id="none_instead_of_bool"),
        pytest.param(None, id="none_instead_of_dict"),
        pytest.param({}, id="empty_dict"),
    ],
)
@patch("sentry.feedback.usecases.spam_detection.make_signed_seer_api_request")
def test_is_spam_seer_invalid_response(mock_make_seer_request, invalid_response):
    mock_make_seer_request.return_value = MockSeerResponse(200, invalid_response)
    assert is_spam_seer("Test feedback message", 1) is None
    mock_make_seer_request.assert_called_once()
