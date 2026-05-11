from unittest import mock

import pytest
from django.utils import timezone

from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.lib.utils import UNREAL_FEEDBACK_UNATTENDED_MESSAGE, FeedbackCreationSource
from sentry.feedback.usecases.ingest.userreport import save_userreport, validate_user_report
from sentry.models.userreport import UserReport
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


def _mock_event(project_id: int, environment: str):
    return Factories.store_event(
        data={"timestamp": timezone.now().isoformat(), "environment": environment},
        project_id=project_id,
    )


@pytest.fixture
def mock_report_dict() -> UserReportDict:
    return {
        "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
        "name": "Test User",
        "email": "test@example.com",
        "comments": "hello",
    }


@pytest.fixture
def skip_denylist():
    with mock.patch(
        "sentry.feedback.usecases.ingest.userreport.is_in_feedback_denylist", return_value=False
    ):
        yield


@pytest.fixture
def skip_filters():
    with mock.patch(
        "sentry.feedback.usecases.ingest.userreport.validate_user_report",
        return_value=(False, None, None),
    ):
        yield


@pytest.fixture
def skip_eventstore():
    with mock.patch("sentry.services.eventstore.backend.get_event_by_id", return_value=None):
        yield


#################################
# validator tests
#################################


@django_db_all
@pytest.mark.parametrize("field", ["comments", "event_id"])
def test_validator_should_filter_missing_required_field(field, mock_report_dict) -> None:
    del mock_report_dict[field]

    should_filter, tag, reason = validate_user_report(mock_report_dict, 1)
    assert should_filter is True
    assert tag is not None
    assert reason is not None


@django_db_all
def test_validator_should_filter_unreal_unattended_message_with_option(set_sentry_option) -> None:
    with set_sentry_option("feedback.filter_garbage_messages", True):
        should_filter, tag, reason = validate_user_report(
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
def test_validator_should_not_filter_unreal_unattended_message_without_option(
    set_sentry_option,
) -> None:
    with set_sentry_option("feedback.filter_garbage_messages", False):
        should_filter, tag, reason = validate_user_report(
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
def test_validator_should_filter_empty_message_with_option(set_sentry_option) -> None:
    with set_sentry_option("feedback.filter_garbage_messages", True):
        should_filter, tag, reason = validate_user_report(
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
def test_validator_should_not_filter_empty_message_without_option(set_sentry_option) -> None:
    with set_sentry_option("feedback.filter_garbage_messages", False):
        should_filter, tag, reason = validate_user_report(
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


@django_db_all
def test_validator_should_not_filter_empty_email() -> None:
    should_filter, tag, reason = validate_user_report(
        {
            "name": "",
            "email": "",
            "comments": "hello",
            "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
        },
        1,
    )
    assert should_filter is False
    assert tag is None
    assert reason is None


@django_db_all
def test_validator_should_filter_invalid_event_id() -> None:
    should_filter, tag, reason = validate_user_report(
        {
            "name": "",
            "email": "andrew@example.com",
            "comments": "hello",
            "event_id": "invalid",
        },
        1,
    )
    assert should_filter is True
    assert tag is not None
    assert reason is not None


@django_db_all
def test_validator_strips_event_id_dashes() -> None:
    report: UserReportDict = {
        "name": "",
        "email": "andrew@example.com",
        "comments": "hello",
        "event_id": "a49558bf-9bd9-4e2d-a4c9-c3dc1b5b95f7",
    }
    should_filter, _, _ = validate_user_report(report, 1)
    assert should_filter is False
    assert report["event_id"] == "a49558bf9bd94e2da4c9c3dc1b5b95f7"


@django_db_all
def test_validator_strips_comments_whitespace() -> None:
    report: UserReportDict = {
        "name": "",
        "email": "andrew@example.com",
        "comments": "                     hello  \n\t      ",
        "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
    }
    should_filter, _, _ = validate_user_report(report, 1)
    assert should_filter is False
    assert report["comments"] == "hello"


# Too large filters are tested below

#######################
# save_userreport tests
#######################


@django_db_all
def test_save_user_report_basic(
    default_project, skip_denylist, skip_filters, skip_eventstore, mock_report_dict
):
    result = save_userreport(
        default_project, mock_report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE
    )

    assert isinstance(result, UserReport)
    assert UserReport.objects.count() == 1
    assert result == UserReport.objects.get()
    assert result.name == mock_report_dict["name"]
    assert result.email == mock_report_dict["email"]
    assert result.comments == mock_report_dict["comments"]
    assert result.event_id == mock_report_dict["event_id"]
    assert result.project_id == default_project.id


@django_db_all
def test_save_user_report_filters_denylist(default_project, skip_filters, mock_report_dict) -> None:
    with mock.patch(
        "sentry.feedback.usecases.ingest.userreport.is_in_feedback_denylist", return_value=True
    ):
        result = save_userreport(
            default_project, mock_report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE
        )

    assert result is None


@django_db_all
@pytest.mark.parametrize("field", ["comments", "event_id"])
def test_save_user_report_filters_missing_required_field(
    default_project, skip_denylist, skip_eventstore, mock_report_dict, field
):
    del mock_report_dict[field]

    result = save_userreport(
        default_project, mock_report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE
    )
    assert result is None
    assert UserReport.objects.count() == 0


@django_db_all
def test_save_user_report_missing_name_and_email(
    default_project, skip_denylist, skip_eventstore
) -> None:
    report: UserReportDict = {
        "event_id": "a49558bf9bd94e2da4c9c3dc1b5b95f7",
        "comments": "hello",
        "project_id": default_project.id,
    }

    result = save_userreport(default_project, report, FeedbackCreationSource.USER_REPORT_ENVELOPE)
    assert isinstance(result, UserReport)
    assert UserReport.objects.count() == 1
    assert result == UserReport.objects.get()
    assert result.name == ""
    assert result.email == ""


@django_db_all
@pytest.mark.parametrize("field", ["name", "email", "comments"])
def test_save_user_report_filters_too_large_fields(
    default_project, skip_denylist, skip_eventstore, mock_report_dict, field
):
    max_length = UserReport._meta.get_field(field).max_length  # type: ignore[union-attr]
    if not max_length:
        assert False, f"Missing max_length for UserReport {field} field!"

    mock_report_dict[field] = "a" * (max_length + 1)

    result = save_userreport(
        default_project, mock_report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE
    )
    assert result is None
    assert UserReport.objects.count() == 0


@django_db_all
def test_save_user_report_shims_if_event_found(
    default_project, skip_denylist, skip_filters, mock_report_dict
):
    event = _mock_event(default_project.id, "prod")
    with (
        mock.patch("sentry.services.eventstore.backend.get_event_by_id", return_value=event),
        mock.patch(
            "sentry.feedback.usecases.ingest.userreport.shim_to_feedback"
        ) as mock_shim_to_feedback,
    ):
        mock_report_dict["event_id"] = event.event_id

        save_userreport(
            default_project, mock_report_dict, FeedbackCreationSource.USER_REPORT_ENVELOPE
        )
    mock_shim_to_feedback.assert_called_once()


@django_db_all
def test_save_user_report_does_not_shim_if_event_found_but_source_is_new_feedback(
    default_project, skip_denylist, skip_filters, mock_report_dict
):
    event = _mock_event(default_project.id, "prod")
    with (
        mock.patch("sentry.services.eventstore.backend.get_event_by_id", return_value=event),
        mock.patch(
            "sentry.feedback.usecases.ingest.userreport.shim_to_feedback"
        ) as mock_shim_to_feedback,
    ):
        # Source is new feedback, so no shim
        save_userreport(
            default_project,
            mock_report_dict,
            FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        )
    assert mock_shim_to_feedback.call_count == 0
