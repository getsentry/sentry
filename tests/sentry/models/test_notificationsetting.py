from sentry.models.notificationsetting import NotificationSetting
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.types.integrations import ExternalProviders


def _get_kwargs(kwargs):
    return dict(
        provider=ExternalProviders.EMAIL, type=NotificationSettingTypes.ISSUE_ALERTS, **kwargs
    )


def assert_no_notification_settings():
    assert NotificationSetting.objects.all().count() == 0
    assert NotificationSettingOption.objects.all().count() == 0
    assert NotificationSettingProvider.objects.all().count() == 0


def create_setting(**kwargs):
    NotificationSetting.objects.update_settings(
        value=NotificationSettingOptionValues.ALWAYS,
        **_get_kwargs(kwargs),
    )


@control_silo_test(stable=True)
class NotificationSettingTest(TestCase):
    def test_remove_for_user(self):
        create_setting(user_id=self.user.id)

        # Refresh user for actor
        self.user = User.objects.get(id=self.user.id)

        # Deletion is deferred and tasks aren't run in tests.
        with outbox_runner():
            self.user.delete()

        assert_no_notification_settings()

    def test_remove_for_team(self):
        create_setting(
            team_id=self.team.id,
            project=self.project,
        )

        # Deletion is deferred and tasks aren't run in tests.
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            self.team.delete()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs_control()

        assert_no_notification_settings()

    def test_remove_for_project(self):
        create_setting(
            user_id=self.user.id,
            project=self.project,
        )
        with assume_test_silo_mode(SiloMode.REGION):
            self.project.delete()
        assert_no_notification_settings()

    def test_remove_for_organization(self):
        create_setting(
            user_id=self.user.id,
            organization=self.organization,
        )
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            self.organization.delete()
        assert_no_notification_settings()

    def test_user_id(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )
        ns = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user_id=self.user.id,
        )[0]
        assert ns.user_id == self.user.id
        assert ns.team_id is None

    def test_team_id(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team_id=self.team.id,
        )
        ns = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            team_id=self.team.id,
        )[0]
        assert ns.team_id == self.team.id
        assert ns.user_id is None
