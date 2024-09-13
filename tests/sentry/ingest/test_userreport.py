from datetime import timedelta

import pytest
from django.utils import timezone

from sentry.feedback.usecases.create_feedback import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
)
from sentry.ingest.userreport import (
    DUP_REPORT_MAX_AGE,
    EVENT_MAX_AGE,
    Conflict,
    is_org_in_denylist,
    save_userreport,
    should_filter_user_report,
)
from sentry.models.userreport import UserReport
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import iso_format
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
def test_org_denylist(set_sentry_option, default_project):
    with set_sentry_option(
        "feedback.organizations.slug-denylist", [default_project.organization.slug]
    ):
        assert is_org_in_denylist(default_project.organization) is True


@django_db_all
def test_org_denylist_not_in_list(set_sentry_option, default_project):
    with set_sentry_option("feedback.organizations.slug-denylist", ["not-in-list"]):
        assert is_org_in_denylist(default_project.organization) is False


@django_db_all
def test_save_userreport_no_event(set_sentry_option, default_project, monkeypatch):
    # Mocking dependencies and setting up test data
    monkeypatch.setattr("sentry.ingest.userreport.is_org_in_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)
    # monkeypatch.setattr(
    #     "sentry.ingest.userreport.UserReport.objects.create", lambda **kwargs: UserReport()
    # )
    monkeypatch.setattr(
        "sentry.eventstore.backend.get_event_by_id", lambda project_id, event_id: None
    )

    # Test data
    test_start = timezone.now()
    report_dict = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    ret = save_userreport(default_project, report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    assert isinstance(ret, UserReport)
    report = UserReport.objects.get(event_id="123456")
    assert ret == report

    assert report.project_id == default_project.id
    assert report.name == report_dict["name"]
    assert report.email == report_dict["email"]
    assert report.comments == report_dict["comments"]
    assert test_start < report.date_added < timezone.now()


@django_db_all
def test_save_userreport_with_event(set_sentry_option, default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_org_in_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)

    test_start = timezone.now()
    event = Factories.store_event(data={}, project_id=default_project.id)
    report_dict = {
        "event_id": event.event_id,
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    ret = save_userreport(default_project, report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    assert isinstance(ret, UserReport)
    report = UserReport.objects.get(event_id=event.event_id)
    assert ret == report

    assert report.event_id == event.event_id
    assert report.group_id == event.group_id
    assert report.environment_id == event.get_environment().id

    assert report.project_id == default_project.id
    assert report.name == report_dict["name"]
    assert report.email == report_dict["email"]
    assert report.comments == report_dict["comments"]
    assert test_start < report.date_added < timezone.now()


@django_db_all
def test_save_userreport_old_event(set_sentry_option, default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_org_in_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)

    event_dt = timezone.now() - EVENT_MAX_AGE - timedelta(minutes=1)
    event = Factories.store_event(
        data={"timestamp": iso_format(event_dt)}, project_id=default_project.id
    )
    report_dict = {
        "event_id": event.event_id,
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    with pytest.raises(Conflict):
        save_userreport(default_project, report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE)


@django_db_all
def test_save_userreport_existing_too_old(set_sentry_option, default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_org_in_denylist", lambda org: False)
    monkeypatch.setattr("sentry.ingest.userreport.should_filter_user_report", lambda message: False)

    event_id = "a" * 32
    UserReport.objects.create(
        project_id=default_project.id,
        event_id=event_id,
        date_added=timezone.now() - DUP_REPORT_MAX_AGE - timedelta(minutes=1),
    )
    report_dict = {
        "event_id": event_id,
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    with pytest.raises(Conflict):
        save_userreport(default_project, report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE)


@django_db_all
def test_save_userreport_denylist(set_sentry_option, default_project, monkeypatch):
    monkeypatch.setattr("sentry.ingest.userreport.is_org_in_denylist", lambda org: True)
    report = {
        "event_id": "123456",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "This is a test feedback",
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)

    assert result is None
