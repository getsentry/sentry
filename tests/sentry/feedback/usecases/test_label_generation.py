from typing import int
from unittest.mock import patch

import pytest
import requests

from sentry.feedback.usecases.label_generation import generate_labels
from sentry.utils import json
from tests.sentry.feedback import MockSeerResponse


@patch("sentry.feedback.usecases.label_generation.make_signed_seer_api_request")
def test_generate_labels_success_response(mock_make_seer_request) -> None:
    mock_response = MockSeerResponse(
        200,
        {"data": {"labels": ["User Interface", "Navigation", "Right Sidebar"]}},
    )
    mock_make_seer_request.return_value = mock_response

    labels = generate_labels(
        "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
    )

    mock_make_seer_request.assert_called_once()
    request_body = json.loads(mock_make_seer_request.call_args[1]["body"].decode("utf-8"))
    expected_request = {
        "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
        "organization_id": 1,
    }
    assert request_body == expected_request

    assert labels == ["User Interface", "Navigation", "Right Sidebar"]


@patch("sentry.feedback.usecases.label_generation.make_signed_seer_api_request")
def test_generate_labels_failed_response(mock_make_seer_request) -> None:
    mock_response = MockSeerResponse(
        500,
        {"error": "Internal Server Error"},
    )
    mock_make_seer_request.return_value = mock_response

    with pytest.raises(Exception, match="Seer returned non-200 response"):
        generate_labels(
            "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
        )

    mock_make_seer_request.assert_called_once()
    request_body = json.loads(mock_make_seer_request.call_args[1]["body"].decode("utf-8"))
    expected_request = {
        "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
        "organization_id": 1,
    }
    assert request_body == expected_request


@patch("sentry.feedback.usecases.label_generation.make_signed_seer_api_request")
def test_generate_labels_network_error(mock_make_seer_request) -> None:
    mock_make_seer_request.side_effect = requests.exceptions.Timeout("Request timed out")

    with pytest.raises(requests.exceptions.Timeout, match="Request timed out"):
        generate_labels(
            "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
        )

    assert mock_make_seer_request.call_count == 1
    request_body = json.loads(mock_make_seer_request.call_args[1]["body"].decode("utf-8"))
    expected_request = {
        "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
        "organization_id": 1,
    }
    assert request_body == expected_request
