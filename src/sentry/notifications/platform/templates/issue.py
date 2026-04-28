from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from sentry.models.rule import Rule
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)


class SerializableRuleProxy(BaseModel):
    """
    A pydantic-serializable representation of a rule for notification render code.
    """

    model_config = ConfigDict(frozen=True)

    id: int
    label: str
    data: dict[str, Any]
    environment_id: int | None = None
    project_id: int

    @classmethod
    def from_rule(cls, rule: Rule) -> SerializableRuleProxy:
        """
        Temporary method to convert a Rule to a NotificationRuleInfo. This will
        be removed once we no longer rely on the Rule ORM model.
        """
        return cls(
            id=rule.id,
            label=rule.label,
            data=rule.data,
            environment_id=rule.environment_id,
            project_id=rule.project.id,
        )

    def to_rule(self) -> Rule:
        """
        Temporary method to convert a NotificationRuleInfo to a Rule. This will
        be removed once we no longer rely on the Rule ORM model.
        """
        return Rule(
            id=self.id,
            label=self.label,
            data=self.data,
            environment_id=self.environment_id,
            project_id=self.project_id,
        )


class IssueNotificationData(NotificationData):
    source: NotificationSource = NotificationSource.ISSUE

    group_id: int
    event_id: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    rule: SerializableRuleProxy
    notification_uuid: str = ""


@template_registry.register(NotificationSource.ISSUE)
class IssueNotificationTemplate(NotificationTemplate[IssueNotificationData]):
    category = NotificationCategory.ISSUE
    example_data = IssueNotificationData(
        group_id=1,
        event_id="abc123",
        notification_uuid="test-uuid",
        tags=["environment", "level"],
        notes="example note",
        rule=SerializableRuleProxy(
            id=1,
            project_id=2,
            label="Example Rule",
            data={
                "actions": [{"workflow_id": 3}],
            },
        ),
    )
    hide_from_debugger = True

    def render(self, data: IssueNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Issue Alert", body=[])
