from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedImage,
    NotificationRenderedTemplate,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)


@dataclass(kw_only=True, frozen=True)
class MockNotification(NotificationData):
    source = "test"
    message: str


@template_registry.register(MockNotification.source)
class MockNotificationTemplate(NotificationTemplate[MockNotification]):
    category = NotificationCategory.DEBUG
    example_data = MockNotification(message="This is a mock notification")

    def render(self, data: MockNotification) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Mock Notification",
            body=data.message,
            actions=[
                NotificationRenderedAction(label="Visit Sentry", link="https://www.sentry.io")
            ],
            chart=NotificationRenderedImage(
                url="https://raw.githubusercontent.com/knobiknows/all-the-bufo/main/all-the-bufo/bufo-pog.png",
                alt_text="Bufo Pog",
            ),
            footer="This is a mock footer",
        )


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets
