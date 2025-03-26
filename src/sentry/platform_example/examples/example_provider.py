from dataclasses import dataclass
from typing import Any

from sentry.platform_example.notification import NotificationData, NotificationTemplate
from sentry.platform_example.notification_provider import NotificationProvider, ProviderTarget
from sentry.platform_example.notification_renderer import NotificationRenderer
from sentry.platform_example.notification_target import NotificationType
from sentry.platform_example.registry import ProviderRegistry


# Example Provider
class ExampleNotificationRenderer(NotificationRenderer[str]):
    """
    Example renderer that processes a template and data, returning a string.
    This is missing an abstraction though, since a renderer shouldn't have to
    concern itself with the template and raw data. This likely needs an
    intermediate representation that encapsulates individual notification
    "components", such as a Title, Text string, link, chart, etc..
    """

    def render(
        self,
        notification_content: NotificationData,
        notification_template: NotificationTemplate,
    ) -> str:
        return "Hello, World!"


class ExampleNotificationProvider(NotificationProvider[str]):
    def send_notification(
        self,
        notification_content: str,
        notification_type: NotificationType,
        target: ProviderTarget,
    ) -> None:
        # print(notification_content)
        pass

    def get_renderer(self, notification_type: NotificationType) -> NotificationRenderer[str]:
        return ExampleNotificationRenderer()


ProviderRegistry.register_provider(ExampleNotificationProvider(), "example")


# Slack Example
@dataclass
class SlackBlockKitData:
    blocks: list[dict[str, Any]]


class SlackNotificationProvider(NotificationProvider[SlackBlockKitData]):
    def send_notification(
        self,
        notification_content: SlackBlockKitData,
        notification_type: NotificationType,
        target: ProviderTarget,
    ) -> None:
        pass

    def get_renderer(
        self, notification_type: NotificationType
    ) -> NotificationRenderer[SlackBlockKitData]:
        return SlackNotificationRenderer()


class SlackNotificationRenderer(NotificationRenderer[SlackBlockKitData]):
    def render(
        self,
        notification_content: NotificationData,
        notification_template: NotificationTemplate,
    ) -> SlackBlockKitData:
        return SlackBlockKitData(
            blocks=[],
        )
