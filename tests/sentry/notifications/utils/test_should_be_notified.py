from unittest import TestCase

from sentry.models import User
from sentry.notifications.helpers import where_should_recipient_be_notified
from sentry.notifications.types import NotificationScopeType, NotificationSettingOptionValues
from sentry.testutils.helpers import with_feature
from sentry.types.integrations import ExternalProviders


class WhereShouldBeNotifiedTest(TestCase):
    def setUp(self) -> None:
        self.user = User(id=1)

    def test_where_should_user_be_notified(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }
        assert where_should_recipient_be_notified(notification_settings, self.user) == [
            ExternalProviders.EMAIL
        ]

    def test_where_should_user_be_notified_two_providers(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.ALWAYS,
                }
            }
        }
        assert where_should_recipient_be_notified(notification_settings, self.user) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]

    def test_default_slack_disabled(self):
        assert where_should_recipient_be_notified({}, self.user) == [
            ExternalProviders.EMAIL,
        ]

    @with_feature("users:notification-slack-automatic")
    def test_default_slack_enabled_with_feature_flag(self):
        assert where_should_recipient_be_notified({}, self.user) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]
