from sentry.models import NotificationSetting
from sentry.models.actor import get_actor_for_user
from sentry.models.user import User
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import TestCase
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


class NotificationSettingTest(TestCase):
    def test_remove_for_user(self):
        create_setting(actor=RpcActor.from_orm_user(self.user))

        # Refresh user for actor
        self.user = User.objects.get(id=self.user.id)

        # Deletion is deferred and tasks aren't run in tests.
        self.user.delete()
        get_actor_for_user(self.user).delete()

        assert_no_notification_settings()

    def test_remove_for_team(self):
        create_setting(actor=RpcActor.from_orm_team(self.team), project=self.project)

        # Deletion is deferred and tasks aren't run in tests.
        self.team.delete()

        assert_no_notification_settings()

    def test_remove_for_project(self):
        create_setting(actor=RpcActor.from_orm_user(self.user), project=self.project)
        self.project.delete()
        assert_no_notification_settings()

    def test_remove_for_organization(self):
        create_setting(actor=RpcActor.from_orm_user(self.user), organization=self.organization)
        self.organization.delete()
        assert_no_notification_settings()
