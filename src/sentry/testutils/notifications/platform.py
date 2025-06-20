from dataclasses import dataclass

from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
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


class MockNotificationTemplate(NotificationTemplate[MockNotification]):
    def process(self, *, data: MockNotification) -> NotificationRenderedTemplate:
        return data.message


class MockStrategy(NotificationStrategy):
    def __init__(self, *, targets: list[NotificationTarget]):
        self.targets = targets

    def get_targets(self) -> list[NotificationTarget]:
        return self.targets
