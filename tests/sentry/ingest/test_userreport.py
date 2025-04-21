from unittest.mock import Mock

from django.utils import timezone

from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.usecases.create_feedback import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
)
from sentry.ingest.userreport import save_userreport, should_filter_user_report
from sentry.models.userreport import UserReport
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


def _mock_event(project_id: int, environment: str):
    return Factories.store_event(
        data={"timestamp": timezone.now().isoformat(), "environment": environment},
        project_id=project_id,
    )


#################################
# should_filter_user_report tests
#################################


@django_db_all
def test_should_filter_unreal_unattended_message_with_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", True):
        should_filter, tag, reason = should_filter_user_report(
            {
                "name": "",
                "email": "",
                "comments": UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
                "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
            },
            1,
        )
        assert should_filter is True
        assert tag is not None
        assert reason is not None


@django_db_all
def test_should_not_filter_unreal_unattended_message_without_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", False):
        should_filter, tag, reason = should_filter_user_report(
            {
                "name": "",
                "email": "",
                "comments": UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
                "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
            },
            1,
        )
        assert should_filter is False
        assert tag is None
        assert reason is None


@django_db_all
def test_should_filter_empty_message_with_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", True):
        should_filter, tag, reason = should_filter_user_report(
            {
                "name": "",
                "email": "",
                "comments": "",
                "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
            },
            1,
        )
        assert should_filter is True
        assert tag is not None
        assert reason is not None


@django_db_all
def test_should_not_filter_empty_message_without_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", False):
        should_filter, tag, reason = should_filter_user_report(
            {
                "name": "",
                "email": "",
                "comments": "",
                "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
            },
            1,
        )
        assert should_filter is False
        assert tag is None
        assert reason is None


# Required field and too large filters are tested below

#######################
# save_userreport tests
#######################


@django_db_all
def test_save_user_report_returns_instance(default_project, monkeypatch):
    # Mocking dependencies and setting up test data
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr(
        "sentry.ingest.userreport.should_filter_user_report", Mock(return_value=(False, None, None))
    )
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id", lambda project_id, event_id: None
    )

    # Test data
    report: UserReportDict = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    # Call the function
    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)

    # Assert the result is an instance of UserReport
    assert isinstance(result, UserReport)


@django_db_all
def test_save_user_report_denylist(default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: True)
    report: UserReportDict = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)

    assert result is None


@django_db_all
def test_save_user_report_filters_large_message(default_project, monkeypatch):
    # Mocking dependencies and setting up test data
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id", lambda project_id, event_id: None
    )

    max_length = UserReport._meta.get_field("comments").max_length
    if not max_length:
        assert False, "Missing max_length for UserReport comments field!"

    report: UserReportDict = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "a" * (max_length + 3001),
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    assert result is None
    assert UserReport.objects.count() == 0


@django_db_all
def test_save_user_report_shims_if_event_found(default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr(
        "sentry.ingest.userreport.should_filter_user_report",
        Mock(return_value=(False, None, None)),
    )

    event = _mock_event(default_project.id, "prod")
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id",
        lambda project_id, event_id: event,
    )

    mock_shim_to_feedback = Mock()
    monkeypatch.setattr("sentry.ingest.userreport.shim_to_feedback", mock_shim_to_feedback)

    report: UserReportDict = {
        "event_id": event.event_id,
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    mock_shim_to_feedback.assert_called_once()


@django_db_all
def test_save_user_report_does_not_shim_if_event_found_but_source_is_new_feedback(
    default_project, monkeypatch
):
    # Exact same setup as test_save_user_report_shims_if_event_found
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr(
        "sentry.ingest.userreport.should_filter_user_report",
        Mock(return_value=(False, None, None)),
    )

    event = _mock_event(default_project.id, "prod")
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id",
        lambda project_id, event_id: event,
    )

    mock_shim_to_feedback = Mock()
    monkeypatch.setattr("sentry.ingest.userreport.shim_to_feedback", mock_shim_to_feedback)

    report: UserReportDict = {
        "event_id": event.event_id,
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    # Source is new feedback, so no shim
    save_userreport(
        default_project,
        report,
        FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
    )
    assert mock_shim_to_feedback.call_count == 0
