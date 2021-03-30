from sentry.models import NotificationSetting
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import NotificationSettingTypes, NotificationSettingOptionValues
from sentry.testutils import TestCase


def _get_kwargs(kwargs):
    return dict(
        provider=ExternalProviders.EMAIL, type=NotificationSettingTypes.ISSUE_ALERTS, **kwargs
    )


def assert_no_notification_settings(**kwargs):
    assert NotificationSetting.objects._filter(**kwargs).count() == 0


def create_setting(**kwargs):
    NotificationSetting.objects.update_settings(
        value=NotificationSettingOptionValues.ALWAYS,
        **_get_kwargs(kwargs),
    )


class NotificationSettingTest(TestCase):
    def test_remove_for_user(self):
        create_setting(user=self.user)

        # Deletion is deferred and tasks aren't run in tests.
        self.user.delete()
        self.user.actor.delete()

        assert_no_notification_settings()

    def test_remove_for_team(self):
        create_setting(team=self.team, project=self.project)

        # Deletion is deferred and tasks aren't run in tests.
        self.team.delete()
        self.team.actor.delete()

        assert_no_notification_settings()

    def test_remove_for_project(self):
        create_setting(user=self.user, project=self.project)
        self.project.delete()
        assert_no_notification_settings()

    def test_remove_for_organization(self):
        create_setting(user=self.user, organization=self.organization)
        self.organization.delete()
        assert_no_notification_settings()
