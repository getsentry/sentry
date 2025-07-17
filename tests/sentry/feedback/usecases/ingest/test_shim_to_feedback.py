"""
shim_to_feedback unit tests. Integration testing is done in test_create_feedback, test_project_user_reports, test_post_process, and test_update_user_reports.
"""

from unittest.mock import Mock

import pytest

from sentry.eventstore.models import Event
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.shim_to_feedback import shim_to_feedback
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.mark.parametrize("use_username", (False, True))
@django_db_all
def test_shim_to_feedback_event_user_used_if_missing(
    default_project, mock_produce_occurrence_to_kafka, use_username
):
    """Uses the error event's user context if user info is missing from the report."""
    report_dict = {
        "comments": "Shim this",
        "event_id": "a" * 32,
        "level": "error",
    }

    event_id = "a" * 32
    user_context = (
        {"username": "Josh", "email": "josh.ferge@sentry.io"}
        if use_username
        else {"name": "Josh", "email": "josh.ferge@sentry.io"}
    )
    event = Factories.store_event(
        data={"event_id": event_id, "user": user_context},
        project_id=default_project.id,
    )

    shim_to_feedback(
        report_dict, event, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    assert produced_event["contexts"]["feedback"]["name"] == "Josh"
    assert produced_event["contexts"]["feedback"]["contact_email"] == "josh.ferge@sentry.io"


@pytest.mark.parametrize("use_username", (False, True))
@django_db_all
def test_shim_to_feedback_event_user_does_not_override_report(
    default_project, mock_produce_occurrence_to_kafka, use_username
):
    """The report's user info should take precedence over the event."""
    report_dict = {
        "name": "Andrew",
        "email": "andrew@example.com",
        "comments": "Shim this",
        "event_id": "a" * 32,
        "level": "error",
    }

    event_id = "a" * 32
    user_context = (
        {"username": "Josh", "email": "josh.ferge@sentry.io"}
        if use_username
        else {"name": "Josh", "email": "josh.ferge@sentry.io"}
    )
    event = Factories.store_event(
        data={"event_id": event_id, "user": user_context},
        project_id=default_project.id,
    )

    shim_to_feedback(
        report_dict, event, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    assert produced_event["contexts"]["feedback"]["name"] == "Andrew"
    assert produced_event["contexts"]["feedback"]["contact_email"] == "andrew@example.com"


@django_db_all
def test_shim_to_feedback_no_user_info(default_project, mock_produce_occurrence_to_kafka):
    """User fields default to "" if not present."""
    report_dict = {
        "comments": "Shim this",
        "event_id": "a" * 32,
        "level": "error",
    }

    event_id = "a" * 32
    event = Factories.store_event(
        data={"event_id": event_id},
        project_id=default_project.id,
    )

    shim_to_feedback(
        report_dict, event, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    assert produced_event["contexts"]["feedback"]["name"] == ""
    assert produced_event["contexts"]["feedback"]["contact_email"] == ""


@django_db_all
def test_shim_to_feedback_fails_if_required_fields_missing(default_project, monkeypatch):
    # Email and comments are required to shim. Tests key errors are handled.
    mock_create_feedback_issue = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.ingest.shim_to_feedback.create_feedback_issue",
        mock_create_feedback_issue,
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
