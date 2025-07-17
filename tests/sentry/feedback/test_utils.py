from sentry.feedback.lib.utils import is_in_feedback_denylist
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_denylist(set_sentry_option, default_project):
    with set_sentry_option(
        "feedback.organizations.slug-denylist", [default_project.organization.slug]
    ):
        assert is_in_feedback_denylist(default_project.organization) is True


@django_db_all
def test_denylist_not_in_list(set_sentry_option, default_project):
    with set_sentry_option("feedback.organizations.slug-denylist", ["not-in-list"]):
        assert is_in_feedback_denylist(default_project.organization) is False
