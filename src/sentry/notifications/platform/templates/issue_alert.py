from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from sentry.models.rule import Rule
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)

if TYPE_CHECKING:
    from sentry.workflow_engine.types import ActionInvocation


@dataclass(frozen=True)
class IssueAlertNotificationData(NotificationData):
    group_id: int
    event_id: str | None = None
    rule: Rule | None = None
    tags: set[str] = field(default_factory=set)
    notes: str = ""
    notification_uuid: str = ""

    source: NotificationSource = NotificationSource.ISSUE_ALERT

    @classmethod
    def from_action_invocation(
        cls,
        invocation: ActionInvocation,
    ) -> IssueAlertNotificationData:
        from sentry.notifications.notification_action.types import BaseIssueAlertHandler
        from sentry.workflow_engine.typings.notification_action import SlackDataBlob

        action = invocation.action
        detector = invocation.detector
        event_data = invocation.event_data

        blob = SlackDataBlob(**action.data)
        tags_set = {t.strip() for t in blob.tags.split(",") if t.strip()} if blob.tags else set()

        rule = BaseIssueAlertHandler.create_rule_instance_from_action(
            action=action,
            detector=detector,
            event_data=event_data,
        )

        event_id = getattr(event_data.event, "event_id", None) if event_data.event else None

        return cls(
            event_id=event_id,
            group_id=event_data.group.id,
            tags=tags_set,
            notes=blob.notes,
            notification_uuid=invocation.notification_uuid,
            rule=rule,
        )


@template_registry.register(IssueAlertNotificationData.source)
class IssueAlertNotificationTemplate(NotificationTemplate[IssueAlertNotificationData]):
    category = NotificationCategory.ISSUE_ALERT
    example_data = IssueAlertNotificationData(
        group_id=1,
        event_id="abc123",
        tags={"environment", "level"},
        notes="example note",
        notification_uuid="test-uuid",
        rule=Rule(id=1, label="Example Rule"),
    )
    hide_from_debugger = True

    def render(self, data: IssueAlertNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Issue Alert", body=[])
