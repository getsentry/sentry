from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
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

    def render(self, data: MockNotification) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Mock Notification",
            body=data.message,
            actions=[{"label": "Visit Sentry", "link": "https://www.sentry.io"}],
            footer="This is a mock footer",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Mock Notification",
            body="This is a mock notification",
            actions=[{"label": "Visit Sentry", "link": "https://www.sentry.io"}],
            footer="This is a mock footer",
        )


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets
