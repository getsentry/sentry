from unittest.mock import Mock

from sentry.eventstore.models import Event
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.shim_to_feedback import shim_to_feedback
from sentry.testutils.pytest.fixtures import django_db_all

"""
Unit tests for shim_to_feedback. These are mostly error cases - the typical behavior of this function is covered in
test_project_user_reports, test_post_process, and test_update_user_reports.
"""


@django_db_all
def test_shim_to_feedback_missing_event(default_project, monkeypatch):
    # Not allowing this since creating feedbacks with no environment (copied from the associated event) doesn't work well.
    mock_create_feedback_issue = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.create_feedback_issue", mock_create_feedback_issue
    )
    report_dict = {
        "name": "andrew",
        "email": "aliu@example.com",
        "comments": "Shim this",
        "event_id": "a" * 32,
        "level": "error",
    }
    shim_to_feedback(
        report_dict, None, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )
    # Error is handled:
    assert mock_create_feedback_issue.call_count == 0


@django_db_all
def test_shim_to_feedback_missing_fields(default_project, monkeypatch):
    # Email and comments are required to shim. Tests key errors are handled.
    mock_create_feedback_issue = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.create_feedback_issue", mock_create_feedback_issue
    )
    report_dict = {
        "name": "andrew",
        "event_id": "a" * 32,
        "level": "error",
    }
    event = Event(event_id="a" * 32, project_id=default_project.id)
    shim_to_feedback(
        report_dict, event, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )
    assert mock_create_feedback_issue.call_count == 0
