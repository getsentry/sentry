from sentry.models.notificationsetting import NotificationSetting
from sentry.models.user import User
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.tasks.deletion.hybrid_cloud import schedule_hybrid_cloud_foreign_key_jobs
from sentry.testutils import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


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


@control_silo_test
class NotificationSettingTest(TestCase):
    def test_remove_for_user(self):
        create_setting(actor=RpcActor.from_orm_user(self.user))

        # Refresh user for actor
        self.user = User.objects.get(id=self.user.id)

        # Deletion is deferred and tasks aren't run in tests.
        with outbox_runner():
            self.user.delete()

        assert_no_notification_settings()

    def test_remove_for_team(self):
        create_setting(actor=RpcActor.from_orm_team(self.team), project=self.project)

        # Deletion is deferred and tasks aren't run in tests.
        with outbox_runner():
            self.team.delete()

        with self.tasks():
            schedule_hybrid_cloud_foreign_key_jobs()

        assert_no_notification_settings()

    def test_remove_for_project(self):
        create_setting(actor=RpcActor.from_orm_user(self.user), project=self.project)
        self.project.delete()
        assert_no_notification_settings()

    def test_remove_for_organization(self):
        create_setting(actor=RpcActor.from_orm_user(self.user), organization=self.organization)
        self.organization.delete()
        assert_no_notification_settings()

    def test_user_id(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        ns = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
        )[0]
        assert ns.user_id == self.user.id
        assert ns.team_id is None

    def test_team_id(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )
        ns = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            team=self.team,
        )[0]
        assert ns.team_id == self.team.id
        assert ns.user_id is None

    def test_user_id_bulk(self):
        NotificationSetting.objects.update_settings_bulk(
            notification_settings=[
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.ISSUE_ALERTS,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.QUOTA,
                    NotificationScopeType.USER,
                    self.user.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
            ],
            user=self.user,
        )

        ns1 = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
        )[0]
        ns2 = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.QUOTA,
            user=self.user,
        )[0]

        assert ns1.user_id == self.user.id
        assert ns1.team_id is None
        assert ns2.user_id == self.user.id
        assert ns2.team_id is None

    def test_team_id_bulk(self):
        NotificationSetting.objects.update_settings_bulk(
            notification_settings=[
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.ISSUE_ALERTS,
                    NotificationScopeType.TEAM,
                    self.team.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
                (
                    ExternalProviders.EMAIL,
                    NotificationSettingTypes.QUOTA,
                    NotificationScopeType.TEAM,
                    self.team.id,
                    NotificationSettingOptionValues.ALWAYS,
                ),
            ],
            team=self.team,
        )

        ns1 = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            team=self.team,
        )[0]
        ns2 = NotificationSetting.objects.find_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.QUOTA,
            team=self.team,
        )[0]

        assert ns1.team_id == self.team.id
        assert ns1.user_id is None
        assert ns2.team_id == self.team.id
        assert ns2.user_id is None
