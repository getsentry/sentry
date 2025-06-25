from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification, MockNotificationTemplate


class EmailRendererTest(TestCase):
    def test_default_renderer(self):
        renderer = EmailNotificationProvider.get_renderer(category=NotificationCategory.DEBUG)
        # TODO(ecosystem): Replace this with a real data blob, template and renderable
        assert (
            renderer.render(
                data=MockNotification(message="test"), template=MockNotificationTemplate()
            )
            == {}
        )


class EmailNotificationProviderTest(TestCase):
    def test_basic_fields(self):
        provider = EmailNotificationProvider()
        assert provider.key == NotificationProviderKey.EMAIL
        assert provider.target_class == GenericNotificationTarget
        assert provider.target_resource_types == [NotificationTargetResourceType.EMAIL]

    def test_is_available(self):
        assert EmailNotificationProvider.is_available() is True
        assert EmailNotificationProvider.is_available(organization=self.organization) is True
