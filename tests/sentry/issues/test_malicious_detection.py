from __future__ import annotations

from unittest.mock import Mock, patch

import pytest
from urllib3.exceptions import TimeoutError

from sentry.issues.malicious_detection import (
    get_malicious_issue_classification_from_seer,
)
from sentry.testutils.helpers.options import override_options

ISSUE_CONTEXT = """Issue title: TypeError: Cannot read properties of undefined
Issue message: Cannot read properties of undefined (reading 'profile')
Stack trace:
  at renderProfileSettings (static/app/views/settings/profile.tsx:42)
  at SettingsPage (static/app/views/settings/index.tsx:18)
"""


@pytest.fixture(autouse=True)
def malicious_detection_options():
    with override_options(
        {
            "malicious-issue-detection.seer-timeout": 5,
        }
    ):
        yield


def make_classifier_response(classification: str, reason: str = "unsafe diagnostic") -> Mock:
    response = Mock()
    response.status = 200
    response.json.return_value = {"classification": classification, "reason": reason}
    return response


def test_get_malicious_issue_classification_calls_seer_classifier_endpoint() -> None:
    response = make_classifier_response("yes", "confirmed malicious")

    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        return_value=response,
    ) as mock_classify:
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "yes", "reason": "confirmed malicious"}
    mock_classify.assert_called_once()

    request = mock_classify.call_args.args[0]
    assert request == {
        "organization_id": 1,
        "project_id": 2,
        "issue_context": ISSUE_CONTEXT,
    }
    assert mock_classify.call_args.kwargs["timeout"] == 5
    assert "retries" not in mock_classify.call_args.kwargs
    assert mock_classify.call_args.kwargs["viewer_context"] == {"organization_id": 1}


def test_get_malicious_issue_classification_returns_seer_classification() -> None:
    response = make_classifier_response("no", "normal error")

    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        return_value=response,
    ) as mock_classify:
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "no", "reason": "normal error"}
    mock_classify.assert_called_once()


def test_get_malicious_issue_classification_fails_closed_when_seer_returns_error_status() -> None:
    response = Mock()
    response.status = 500

    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        return_value=response,
    ):
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "no", "reason": "seer request failed"}


def test_get_malicious_issue_classification_fails_closed_when_seer_request_fails() -> None:
    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        side_effect=RuntimeError("request failed"),
    ):
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "no", "reason": "seer request failed"}


def test_get_malicious_issue_classification_fails_closed_when_seer_times_out() -> None:
    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        side_effect=TimeoutError("request timed out"),
    ):
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "no", "reason": "seer request failed"}


def test_get_malicious_issue_classification_fails_closed_for_invalid_seer_response() -> None:
    response = Mock()
    response.status = 200
    response.json.return_value = {"classification": "maybe"}

    with patch(
        "sentry.issues.malicious_detection.make_malicious_issue_detection_request",
        return_value=response,
    ):
        result = get_malicious_issue_classification_from_seer(
            ISSUE_CONTEXT, organization_id=1, project_id=2
        )

    assert result == {"classification": "no", "reason": "invalid seer response"}
