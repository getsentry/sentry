from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
    NotificationType,
)
from sentry.testutils.cases import TestCase


class MSTeamsRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = MSTeamsNotificationProvider.get_renderer(
            notification_type=NotificationType.DEBUG
        )
        # TODO(ecosystem): Replace this with a real data blob, template and renderable
        assert renderer.render(data={}, template={}) == {}


class MSTeamsNotificationProviderTest(TestCase):
    def test_basic_fields(self):
        provider = MSTeamsNotificationProvider()
        assert provider.key == NotificationProviderKey.MSTEAMS
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self):
        assert MSTeamsNotificationProvider.is_available() is False
        assert MSTeamsNotificationProvider.is_available(organization=self.organization) is False
