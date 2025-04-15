from datetime import UTC, datetime
from unittest import mock

import pytest

from sentry.feedback.usecases.create_feedback import FeedbackCreationSource
from sentry.feedback.usecases.save_feedback_event import save_feedback_event
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.feedback.usecases.test_create_feedback import mock_feedback_event


@pytest.fixture
def mock_create_feedback_issue():
    with mock.patch("sentry.feedback.usecases.save_feedback_event.create_feedback_issue") as m:
        yield m


@pytest.fixture
def mock_save_userreport():
    with mock.patch("sentry.feedback.usecases.save_feedback_event.save_userreport") as m:
        yield m


@django_db_all
def test_save_feedback_event_no_associated_error(
    default_project, mock_create_feedback_issue, mock_save_userreport
):
    event_data = mock_feedback_event(default_project.id)
    mock_create_feedback_issue.return_value = None

    save_feedback_event(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    mock_save_userreport.assert_not_called()


@django_db_all
def test_save_feedback_event_with_associated_error(
    default_project, mock_create_feedback_issue, mock_save_userreport
):
    event_data = mock_feedback_event(default_project.id)
    event_data["contexts"]["feedback"]["associated_event_id"] = "abcd" * 8
    mock_create_feedback_issue.return_value = event_data

    save_feedback_event(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    feedback_context = event_data["contexts"]["feedback"]
    mock_save_userreport.assert_called_once_with(
        default_project,
        {
            "event_id": "abcd" * 8,
            "project_id": default_project.id,
            "environment_id": event_data["environment"],
            "name": feedback_context["name"],
            "email": feedback_context["contact_email"],
            "comments": feedback_context["message"],
        },
        FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        start_time=datetime.fromtimestamp(event_data["timestamp"], UTC),
    )
