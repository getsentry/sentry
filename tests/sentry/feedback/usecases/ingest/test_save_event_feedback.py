from datetime import UTC, datetime
from unittest import mock

import pytest

from sentry.eventstore.models import Event
from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.save_event_feedback import save_event_feedback
from sentry.models.environment import Environment
from sentry.models.userreport import UserReport
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.feedback import mock_feedback_event


@pytest.fixture
def mock_create_feedback_issue():
    with mock.patch(
        "sentry.feedback.usecases.ingest.save_event_feedback.create_feedback_issue"
    ) as m:
        yield m


def create_test_event(project_id: int, environment: Environment) -> Event:
    return Factories.store_event(
        {
            "event_id": "ff1c2e3d4b5a6978899abbccddeeff00",
            "environment": environment.name,
        },
        project_id,
    )


@django_db_all
def test_save_event_feedback_no_associated_event(default_project, mock_create_feedback_issue):
    event_data = mock_feedback_event(default_project.id)
    mock_create_feedback_issue.return_value = None

    save_event_feedback(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    assert UserReport.objects.count() == 0


@django_db_all
@pytest.mark.parametrize(
    "timestamp_format",
    ["number", "iso"],
)
def test_save_event_feedback_with_associated_event(
    default_project, mock_create_feedback_issue, timestamp_format
):
    environment = Factories.create_environment(default_project, name="production")
    assoc_event = create_test_event(default_project.id, environment)

    event_data = mock_feedback_event(default_project.id)
    event_data["contexts"]["feedback"]["associated_event_id"] = assoc_event.event_id
    event_data["timestamp"] = (
        datetime.now(UTC).timestamp()
        if timestamp_format == "number"
        else datetime.now(UTC).isoformat()
    )
    event_data["environment"] = "production"
    mock_create_feedback_issue.return_value = event_data

    save_event_feedback(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    assert UserReport.objects.count() == 1
    report = UserReport.objects.get()

    feedback_context = event_data["contexts"]["feedback"]
    assert report.event_id == assoc_event.event_id
    assert report.project_id == default_project.id
    assert report.group_id == assoc_event.group_id
    assert report.environment_id == environment.id
    assert report.name == feedback_context["name"]
    assert report.email == feedback_context["contact_email"]
    assert report.comments == feedback_context["message"]


@django_db_all
def test_save_event_feedback_with_unprocessed_associated_event(
    default_project,
    mock_create_feedback_issue,
):
    environment = Factories.create_environment(default_project, name="production")

    event_data = mock_feedback_event(default_project.id)
    event_data["contexts"]["feedback"]["associated_event_id"] = "abcd" * 8
    event_data["timestamp"] = datetime.now(UTC).isoformat()
    event_data["environment"] = "production"
    mock_create_feedback_issue.return_value = event_data

    save_event_feedback(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    # UserReport is still created, with null group_id.
    assert UserReport.objects.count() == 1
    report = UserReport.objects.get()

    feedback_context = event_data["contexts"]["feedback"]
    assert report.event_id == "abcd" * 8
    assert report.project_id == default_project.id
    assert report.group_id is None
    assert report.environment_id == environment.id
    assert report.name == feedback_context["name"]
    assert report.email == feedback_context["contact_email"]
    assert report.comments == feedback_context["message"]


@django_db_all
def test_save_event_feedback_with_missing_fields(default_project, mock_create_feedback_issue):
    environment = Factories.create_environment(default_project, name="production")

    event_data = mock_feedback_event(default_project.id)
    event_data["contexts"]["feedback"]["associated_event_id"] = "abcd" * 8
    event_data["timestamp"] = datetime.now(UTC).isoformat()

    # Remove name, email, environment
    del event_data["contexts"]["feedback"]["name"]
    del event_data["contexts"]["feedback"]["contact_email"]
    del event_data["environment"]

    mock_create_feedback_issue.return_value = event_data

    save_event_feedback(event_data, default_project.id)

    mock_create_feedback_issue.assert_called_once_with(
        event_data, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    assert UserReport.objects.count() == 1
    report = UserReport.objects.get()

    feedback_context = event_data["contexts"]["feedback"]
    assert report.event_id == "abcd" * 8
    assert report.project_id == default_project.id
    assert report.environment_id == environment.id
    assert report.name == ""
    assert report.email == ""
    assert report.comments == feedback_context["message"]
