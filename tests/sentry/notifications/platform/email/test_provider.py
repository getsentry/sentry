from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.target import NotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
    NotificationType,
)
from sentry.testutils.cases import TestCase


class EmailRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = EmailNotificationProvider.get_renderer(type=NotificationType.DEBUG)
        assert renderer.render(data={}, template={}) == {}


class EmailNotificationProviderTest(TestCase):
    def test_basic_fields(self):
        provider = EmailNotificationProvider()
        assert provider.key == NotificationProviderKey.EMAIL
        assert provider.target_class == NotificationTarget
        assert provider.target_resource_types == [NotificationTargetResourceType.EMAIL]

    def test_is_available(self):
        assert EmailNotificationProvider.is_available() is True
        assert EmailNotificationProvider.is_available(organization=self.organization) is True
