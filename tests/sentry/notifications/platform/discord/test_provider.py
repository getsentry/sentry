from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, mock_notification_loader


class DiscordRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = DiscordNotificationProvider.get_renderer(category=NotificationCategory.DEBUG)
        data = MockNotification(message="test")
        template = mock_notification_loader(data)
        assert renderer.render(data=data, template=template) == {}


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
