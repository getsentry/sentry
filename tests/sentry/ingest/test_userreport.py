from sentry.feedback.usecases.create_feedback import UNREAL_FEEDBACK_UNATTENDED_MESSAGE
from sentry.ingest.userreport import should_filter_user_report
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
