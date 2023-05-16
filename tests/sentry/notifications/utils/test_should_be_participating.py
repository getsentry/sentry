from sentry.models import GroupSubscription
from sentry.notifications.helpers import should_be_participating, where_should_be_participating
from sentry.notifications.types import NotificationScopeType, NotificationSettingOptionValues
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
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


@control_silo_test(stable=True)
class WhereShouldBeParticipatingTest(TestCase):
    def setUp(self) -> None:
        self.user = RpcActor.from_orm_user(self.create_user())

    def test_where_should_be_participating(self):
        subscription = GroupSubscription(is_active=True)
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                    ExternalProviders.PAGERDUTY: NotificationSettingOptionValues.NEVER,
                }
            }
        }

        providers = where_should_be_participating(
            self.user,
            subscription,
            notification_settings,
        )
        assert providers == [ExternalProviders.EMAIL, ExternalProviders.SLACK]

    def test_subscription_null(self):
        notification_settings = {
            self.user: {
                NotificationScopeType.USER: {
                    ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
                    ExternalProviders.SLACK: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
                    ExternalProviders.PAGERDUTY: NotificationSettingOptionValues.NEVER,
                }
            }
        }

        providers = where_should_be_participating(
            self.user,
            None,
            notification_settings,
        )
        assert providers == [ExternalProviders.EMAIL]
