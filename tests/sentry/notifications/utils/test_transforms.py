from sentry.models import NotificationSetting
from sentry.models.actor import get_actor_id_for_user
from sentry.notifications.helpers import (
    transform_to_notification_settings_by_recipient,
    transform_to_notification_settings_by_scope,
)
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications.serial import serialize_notification_setting
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


class TransformTestCase(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)
        self.notification_settings = [
            NotificationSetting(
                provider=ExternalProviders.SLACK.value,
                type=NotificationSettingTypes.WORKFLOW.value,
                value=NotificationSettingOptionValues.ALWAYS.value,
                target_id=get_actor_id_for_user(self.user),
                user_id=self.user.id,
                scope_type=NotificationScopeType.PROJECT.value,
                scope_identifier=self.project.id,
            ),
            NotificationSetting(
                provider=ExternalProviders.SLACK.value,
                type=NotificationSettingTypes.WORKFLOW.value,
                value=NotificationSettingOptionValues.ALWAYS.value,
                target_id=get_actor_id_for_user(self.user),
                user_id=self.user.id,
                scope_type=NotificationScopeType.USER.value,
                scope_identifier=self.user.id,
            ),
        ]

        self.user_actor = RpcActor.from_orm_user(self.user)
        self.rpc_notification_settings = [
            serialize_notification_setting(setting) for setting in self.notification_settings
        ]


@control_silo_test(stable=True)
class TransformToNotificationSettingsByUserTestCase(TransformTestCase):
    def test_transform_to_notification_settings_by_recipient_empty(self):
        assert (
            transform_to_notification_settings_by_recipient(notification_settings=[], recipients=[])
            == {}
        )

        assert (
            transform_to_notification_settings_by_recipient(
                notification_settings=[], recipients=[self.user_actor]
            )
            == {}
        )

    def test_transform_to_notification_settings_by_recipient(self):
        assert transform_to_notification_settings_by_recipient(
            notification_settings=self.rpc_notification_settings, recipients=[self.user_actor]
        ) == {
            self.user_actor: {
                NotificationScopeType.USER: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS
                },
                NotificationScopeType.PROJECT: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS
                },
            }
        }


class TransformToNotificationSettingsByScopeTestCase(TransformTestCase):
    def test_transform_to_notification_settings_by_scope_empty(self):
        assert transform_to_notification_settings_by_scope(notification_settings=[]) == {}

    def test_transform_to_notification_settings_by_scope(self):
        assert transform_to_notification_settings_by_scope(
            notification_settings=self.rpc_notification_settings,
        ) == {
            NotificationScopeType.USER: {
                self.user.id: {ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS},
            },
            NotificationScopeType.PROJECT: {
                self.project.id: {
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                }
            },
        }
