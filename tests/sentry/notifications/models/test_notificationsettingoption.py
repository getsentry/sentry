from sentry.deletions.tasks.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs_control
from sentry.notifications.models.notificationsettingoption import NotificationSettingOption
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.user import User


def assert_no_notification_settings():
    assert NotificationSettingOption.objects.all().count() == 0


@control_silo_test
class NotificationSettingTest(TestCase):
    def test_remove_for_user(self):
        NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type="user",
            scope_identifier=self.user.id,
            type="alerts",
            value="never",
        )

        # Refresh user for actor
        self.user = User.objects.get(id=self.user.id)

        # Deletion is deferred and tasks aren't run in tests.
        with outbox_runner():
            self.user.delete()

        assert_no_notification_settings()

    def test_remove_for_team(self):
        NotificationSettingOption.objects.create(
            team_id=self.team.id,
            scope_type="team",
            scope_identifier=self.team.id,
            type="alerts",
            value="never",
        )

        # Deletion is deferred and tasks aren't run in tests.
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            self.team.delete()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs_control()

        assert_no_notification_settings()

    def test_remove_for_project(self):
        NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type="project",
            scope_identifier=self.project.id,
            type="alerts",
            value="never",
        )

        with assume_test_silo_mode(SiloMode.REGION):
            self.project.delete()
        assert_no_notification_settings()

    def test_remove_for_organization(self):
        NotificationSettingOption.objects.create(
            user_id=self.user.id,
            scope_type="organization",
            scope_identifier=self.organization.id,
            type="alerts",
            value="never",
        )
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            self.organization.delete()
        assert_no_notification_settings()
