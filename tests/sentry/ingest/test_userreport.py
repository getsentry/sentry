from sentry.feedback.usecases.create_feedback import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
)
from sentry.ingest.userreport import save_userreport, should_filter_user_report
from sentry.models.userreport import UserReport
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_unreal_unattended_message_with_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", True):
        assert should_filter_user_report(UNREAL_FEEDBACK_UNATTENDED_MESSAGE) is True


@django_db_all
def test_unreal_unattended_message_without_option(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", False):
        assert should_filter_user_report(UNREAL_FEEDBACK_UNATTENDED_MESSAGE) is False


@django_db_all
def test_empty_message(set_sentry_option):
    with set_sentry_option("feedback.filter_garbage_messages", True):
        assert should_filter_user_report("") is True


@django_db_all
def test_save_user_report_returns_instance(default_project, monkeypatch):
    # Mocking dependencies and setting up test data
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id", lambda project_id, event_id: None
    )

    # Test data
    report = {
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
    report = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)

    assert result is None


@django_db_all
def test_save_user_report_large_message_truncated(default_project, monkeypatch):
    # Mocking dependencies and setting up test data
    monkeypatch.setattr("sentry.ingest.userreport.is_in_feedback_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id", lambda project_id, event_id: None
    )

    max_length = UserReport._meta.get_field("comments").max_length
    if not max_length:
        assert False, "Missing max_length for UserReport comments field!"

    report = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "a" * (max_length + 3001),
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    saved_result = UserReport.objects.get()
    assert isinstance(result, UserReport)
    assert result.id == saved_result.id

    assert len(result.comments) == max_length
    assert len(saved_result.comments) == max_length
