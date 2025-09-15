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
    def test_default_renderer(self) -> None:
        data = MockNotification(message="test")
        template = MockNotificationTemplate()
        rendered_template = template.render(data)
        renderer = SlackNotificationProvider.get_renderer(
            data=data, category=NotificationCategory.DEBUG
        )

        rendererable = renderer.render(data=data, rendered_template=rendered_template)
        rendererable_dict = [block.to_dict() for block in rendererable.get("blocks", [])]

        assert rendererable_dict == [
            {"text": {"text": "Mock Notification", "type": "plain_text"}, "type": "header"},
            {"text": {"text": "test", "type": "mrkdwn"}, "type": "section"},
            {
                "elements": [
                    {
                        "text": {"emoji": True, "text": "Visit Sentry", "type": "plain_text"},
                        "type": "button",
                        "url": "https://www.sentry.io",
                    }
                ],
                "type": "actions",
            },
            {"text": {"text": "This is a mock footer", "type": "mrkdwn"}, "type": "section"},
            {
                "image_url": "https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png",
                "alt_text": "Bufo Pog",
                "type": "image",
            },
        ]


class SlackNotificationProviderTest(TestCase):
    def test_basic_fields(self) -> None:
        provider = SlackNotificationProvider()
        assert provider.key == NotificationProviderKey.SLACK
        assert provider.target_class == IntegrationNotificationTarget
        assert provider.target_resource_types == [
            NotificationTargetResourceType.CHANNEL,
            NotificationTargetResourceType.DIRECT_MESSAGE,
        ]

    def test_is_available(self) -> None:
        assert SlackNotificationProvider.is_available() is False
        assert SlackNotificationProvider.is_available(organization=self.organization) is False
