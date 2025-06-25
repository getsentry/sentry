from sentry.notifications.platform.slack.provider import SlackNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class SlackRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = SlackNotificationProvider.get_renderer(category=NotificationCategory.DEBUG)
        # TODO(ecosystem): Replace this with a real data blob, template and renderable
        assert (
            renderer.render(
                data=MockNotification(message="test"), template=MockNotificationTemplate()
            )
            == {}
        )


class SlackNotificationProviderTest(TestCase):
    def test_basic_fields(self):
        provider = SlackNotificationProvider()
        assert provider.key == NotificationProviderKey.SLACK
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self):
        assert SlackNotificationProvider.is_available() is False
        assert SlackNotificationProvider.is_available(organization=self.organization) is False
