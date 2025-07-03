from dataclasses import dataclass

from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationSource,
    NotificationStrategy,
    NotificationTarget,
    NotificationTemplate,
)


@dataclass(kw_only=True, frozen=True)
class MockNotification(NotificationData):
    category = NotificationCategory.DEBUG
    source = NotificationSource.TEST
    message: str


def mock_notification_loader(data: MockNotification) -> NotificationTemplate:
    return NotificationTemplate(
        subject="Mock Notification",
        body=data.message,
        actions=[
            {
                "label": "Visit Sentry",
                "link": "https://www.sentry.io",
            }
        ],
        footer="This is a mock footer",
    )


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets
