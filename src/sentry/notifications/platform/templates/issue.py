from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from sentry.models.project import Project
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
)
from sentry.notifications.types import TEST_NOTIFICATION_ID, NotificationRule, NotificationRuleData


class SerializableRuleProxy(BaseModel):
    """
    A pydantic-serializable representation of a rule for notification render code.
    """

    model_config = ConfigDict(frozen=True)

    id: int
    action_id: int | None = None
    label: str
    data: dict[str, Any]
    environment_id: int | None = None
    project_id: int
    workflow_id: int | None = None
    legacy_rule_id: int | None = None

    @classmethod
    def from_rule(cls, rule: NotificationRule) -> SerializableRuleProxy:
        """Create a serializable representation of a notification rule."""
        return cls(
            id=rule.broken_rule_id,
            action_id=rule.action_id,
            label=rule.label,
            data=rule.data,
            environment_id=rule.environment_id,
            project_id=rule.project.id,
            workflow_id=rule.workflow_id,
            legacy_rule_id=rule.legacy_rule_id,
        )

    def to_notification_rule(self, project: Project) -> NotificationRule:
        workflow_id = self.workflow_id
        legacy_rule_id = self.legacy_rule_id
        actions = self.data.get("actions")
        if (
            not isinstance(actions, list)
            or not actions
            or not all(isinstance(action, dict) for action in actions)
        ):
            actions = [{}]
        data: NotificationRuleData = {"actions": [dict(action) for action in actions]}
        if workflow_id is None and legacy_rule_id is None:
            # Compatibility for payloads serialized before identities became top-level fields.
            action = actions[0]
            workflow_id = action.get("workflow_id")
            legacy_rule_id = action.get("legacy_rule_id")
            workflow_id = int(workflow_id) if workflow_id is not None else None
            legacy_rule_id = int(legacy_rule_id) if legacy_rule_id is not None else None
            if workflow_id == TEST_NOTIFICATION_ID or legacy_rule_id == TEST_NOTIFICATION_ID:
                workflow_id = None
                legacy_rule_id = TEST_NOTIFICATION_ID
            elif workflow_id is None and legacy_rule_id is None:
                legacy_rule_id = self.id
        return NotificationRule(
            action_id=self.action_id if "action_id" in self.__fields_set__ else self.id,
            label=self.label,
            data=data,
            environment_id=self.environment_id,
            project=project,
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
            legacy_rule_id=None,
        ),
    )
    hide_from_debugger = True

    def render(self, data: IssueNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(subject="Issue Alert", body=[])
