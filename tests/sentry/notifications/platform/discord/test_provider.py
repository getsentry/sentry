from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class DiscordRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = DiscordNotificationProvider.get_renderer(category=NotificationCategory.DEBUG)
        # TODO(ecosystem): Replace this with a real data blob, template and renderable
        assert (
            renderer.render(
                data=MockNotification(message="test"), template=MockNotificationTemplate()
            )
            == {}
        )


class DiscordNotificationProviderTest(TestCase):
    def test_basic_fields(self):
        provider = DiscordNotificationProvider()
        assert provider.key == NotificationProviderKey.DISCORD
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self):
        assert DiscordNotificationProvider.is_available() is False
        assert DiscordNotificationProvider.is_available(organization=self.organization) is False
