from unittest import TestCase

from sentry.models import User
from sentry.notifications.helpers import where_should_recipient_be_notified
from sentry.notifications.types import NotificationScopeType, NotificationSettingOptionValues
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders


class WhereShouldBeNotifiedTest(TestCase):
    def setUp(self) -> None:
        self.user = RpcActor.from_orm_user(User(id=1))

    def test_where_should_user_be_notified(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.NEVER,
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
                }
            }
        }
        assert where_should_recipient_be_notified(notification_settings, self.user) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]

    def test_default_slack_enabled(self):
        assert where_should_recipient_be_notified({}, self.user) == [
            ExternalProviders.EMAIL,
            ExternalProviders.SLACK,
        ]
