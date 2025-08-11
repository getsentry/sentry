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
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = DiscordNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )
        assert renderer.render(data=data, rendered_template=rendered_template) == {}


class DiscordNotificationProviderTest(TestCase):
    def test_basic_fields(self) -> None:
        provider = DiscordNotificationProvider()
        assert provider.key == NotificationProviderKey.DISCORD
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert DiscordNotificationProvider.is_available() is False
        assert DiscordNotificationProvider.is_available(organization=self.organization) is False
