from __future__ import annotations

from dataclasses import dataclass, field

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationRuleInfo,
    NotificationSource,
    NotificationTemplate,
)


@dataclass(frozen=True)
class IssueNotificationData(NotificationData):
    group_id: int
    event_id: str | None = None
    rule: NotificationRuleInfo | None = None
    tags: set[str] = field(default_factory=set)
    notes: str = ""
    notification_uuid: str = ""

    source: NotificationSource = NotificationSource.ISSUE


@template_registry.register(IssueNotificationData.source)
class IssueNotificationTemplate(NotificationTemplate[IssueNotificationData]):
    category = NotificationCategory.ISSUE_ALERT
    example_data = IssueNotificationData(
        group_id=1,
        event_id="abc123",
        tags={"environment", "level"},
        notes="example note",
        notification_uuid="test-uuid",
        rule=NotificationRuleInfo(id=1, label="Example Rule", data={}),
    )
    hide_from_debugger = True

    def render(self, data: IssueNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Issue Alert", body=[])
