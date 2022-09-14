from unittest import TestCase

from sentry.models import Group, NotificationSetting, Project, User
from sentry.notifications.helpers import (
    transform_to_notification_settings_by_recipient,
    transform_to_notification_settings_by_scope,
)
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


class TransformTestCase(TestCase):
    def setUp(self) -> None:
        self.user = User(id=1)
        self.project = Project(id=123)
        self.group = Group(id=456, project=self.project)
        self.notification_settings = [
            NotificationSetting(
                provider=ExternalProviders.SLACK.value,
                type=NotificationSettingTypes.WORKFLOW.value,
                value=NotificationSettingOptionValues.ALWAYS.value,
                target=self.user.actor,
                scope_type=NotificationScopeType.PROJECT.value,
                scope_identifier=self.project.id,
            ),
            NotificationSetting(
                provider=ExternalProviders.SLACK.value,
                type=NotificationSettingTypes.WORKFLOW.value,
                value=NotificationSettingOptionValues.ALWAYS.value,
                target=self.user.actor,
                scope_type=NotificationScopeType.USER.value,
                scope_identifier=self.user.id,
            ),
        ]


@control_silo_test
class TransformToNotificationSettingsByUserTestCase(TransformTestCase):
    def test_transform_to_notification_settings_by_recipient_empty(self):
        assert (
            transform_to_notification_settings_by_recipient(notification_settings=[], recipients=[])
            == {}
        )

        assert (
            transform_to_notification_settings_by_recipient(
                notification_settings=[], recipients=[self.user]
            )
            == {}
        )

    def test_transform_to_notification_settings_by_recipient(self):
        assert transform_to_notification_settings_by_recipient(
            notification_settings=self.notification_settings, recipients=[self.user]
        ) == {
            self.user: {
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
            notification_settings=self.notification_settings,
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
