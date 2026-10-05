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
from sentry.notifications.types import TEST_NOTIFICATION_ID, NotificationOrigin


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
    workflow_id: int | None = None
    legacy_rule_id: int | None = None

    @classmethod
    def from_rule(cls, rule: Rule) -> SerializableRuleProxy:
        origin = NotificationOrigin.from_legacy_rule(rule)
        return cls(
            id=rule.id,
            label=rule.label,
            data=rule.data,
            environment_id=rule.environment_id,
            project_id=rule.project.id,
            workflow_id=origin.workflow_id,
            legacy_rule_id=origin.legacy_rule_id,
        )

    def to_notification_origin(self) -> NotificationOrigin:
        workflow_id = self.workflow_id
        legacy_rule_id = self.legacy_rule_id
        if workflow_id is None and legacy_rule_id is None:
            # Compatibility for payloads serialized before identities became top-level fields.
            actions = self.data.get("actions")
            first_action = actions[0] if isinstance(actions, list) and actions else {}
            workflow_id = first_action.get("workflow_id")
            legacy_rule_id = first_action.get("legacy_rule_id")
            workflow_id = int(workflow_id) if workflow_id is not None else None
            legacy_rule_id = int(legacy_rule_id) if legacy_rule_id is not None else None
            if workflow_id == TEST_NOTIFICATION_ID or legacy_rule_id == TEST_NOTIFICATION_ID:
                workflow_id = None
                legacy_rule_id = TEST_NOTIFICATION_ID
            elif workflow_id is None and legacy_rule_id is None:
                legacy_rule_id = self.id

        return NotificationOrigin(
            label=self.label,
            environment_id=self.environment_id,
            workflow_id=workflow_id,
            legacy_rule_id=legacy_rule_id,
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
        organization_id=1,
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
            workflow_id=3,
        ),
    )
    hide_from_debugger = True

    def render(self, data: IssueNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Issue Alert", body=[])
