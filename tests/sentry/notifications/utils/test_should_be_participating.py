from unittest import TestCase

from sentry.models import GroupSubscription, User
from sentry.notifications.helpers import should_be_participating, where_should_be_participating
from sentry.notifications.types import NotificationScopeType, NotificationSettingOptionValues
from sentry.types.integrations import ExternalProviders


class ShouldBeParticipatingTest(TestCase):
    def test_subscription_on_notification_settings_always(self):
        subscription = GroupSubscription(is_active=True)
        value = should_be_participating(subscription, NotificationSettingOptionValues.ALWAYS)
        assert value

    def test_subscription_off_notification_settings_always(self):
        subscription = GroupSubscription(is_active=False)
        value = should_be_participating(subscription, NotificationSettingOptionValues.ALWAYS)
        assert not value

    def test_subscription_null_notification_settings_always(self):
        value = should_be_participating(None, NotificationSettingOptionValues.ALWAYS)
        assert value

    def test_subscription_on_notification_setting_never(self):
        subscription = GroupSubscription(is_active=True)
        value = should_be_participating(subscription, NotificationSettingOptionValues.NEVER)
        assert not value

    def test_subscription_off_notification_setting_never(self):
        subscription = GroupSubscription(is_active=False)
        value = should_be_participating(subscription, NotificationSettingOptionValues.NEVER)
        assert not value

    def test_subscription_on_subscribe_only(self):
        subscription = GroupSubscription(is_active=True)
        value = should_be_participating(
            subscription, NotificationSettingOptionValues.SUBSCRIBE_ONLY
        )
        assert value

    def test_subscription_off_subscribe_only(self):
        subscription = GroupSubscription(is_active=False)
        value = should_be_participating(
            subscription, NotificationSettingOptionValues.SUBSCRIBE_ONLY
        )
        assert not value

    def test_subscription_null_subscribe_only(self):
        value = should_be_participating(None, NotificationSettingOptionValues.SUBSCRIBE_ONLY)
        assert not value

    def test_where_should_be_participating(self):
        user = User(id=1)
        subscription = GroupSubscription(is_active=True)
        notification_settings = {
            user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
                }
            }
        }

        providers = where_should_be_participating(
            user,
            subscription,
            notification_settings,
        )
        assert providers == [ExternalProviders.EMAIL]
