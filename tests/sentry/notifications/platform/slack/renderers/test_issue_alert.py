from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from sentry.eventstore.models import GroupEvent
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group
from sentry.notifications.platform.slack.provider import SlackNotificationProvider, SlackRenderable
from sentry.notifications.platform.slack.renderers.issue_alert import IssueSlackRenderer
from sentry.notifications.platform.templates.issue_alert import (
    IssueAlertNotificationTemplate,
    IssueNotificationData,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationRuleInfo,
    NotificationSource,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData


class IssueAlertInvocationMixin(TestCase):
    def _create_invocation(
        self,
        *,
        tags: str = "",
        notes: str = "",
        notification_uuid: str = "test-uuid",
        event_data: dict[str, Any] | None = None,
    ) -> ActionInvocation:
        integration = self.create_integration(
            organization=self.organization,
            external_id="T12345",
            provider="slack",
            name="Test Slack",
        )
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type=ErrorGroupType.slug,
        )
        workflow = self.create_workflow(organization=self.organization)
        action = self.create_action(
            type=Action.Type.SLACK,
            data={"tags": tags, "notes": notes},
            config={
                "target_identifier": "C12345",
                "target_display": "#test-channel",
                "target_type": 0,
            },
            integration_id=integration.id,
        )
        action.workflow_id = workflow.id
        event = self.store_event(
            data=event_data or {"message": "test event"},
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None
        group_event = event.for_group(group)

        return ActionInvocation(
            event_data=WorkflowEventData(event=group_event, group=group),
            action=action,
            detector=detector,
            notification_uuid=notification_uuid,
        )


class IssueNotificationDataTest(IssueAlertInvocationMixin):
    def test_source(self) -> None:
        data = IssueNotificationData(group_id=self.group.id)
        assert data.source == NotificationSource.ISSUE_ALERT

    def test_from_action_invocation(self) -> None:
        invocation = self._create_invocation(
            tags="environment,level", notes="test note", notification_uuid="test-uuid-123"
        )

        result = IssueNotificationData.from_action_invocation(invocation)

        assert result.source == NotificationSource.ISSUE_ALERT
        assert result.group_id == invocation.event_data.group.id
        assert isinstance(invocation.event_data.event, GroupEvent)
        assert result.event_id == invocation.event_data.event.event_id
        assert result.tags == {"environment", "level"}
        assert result.notes == "test note"
        assert result.notification_uuid == "test-uuid-123"

        assert isinstance(result.rule, NotificationRuleInfo)
        assert result.rule.id == invocation.action.id
        assert result.rule.label == "Test Detector"
        assert result.rule.environment_id is None

    def test_from_action_invocation_empty_tags(self) -> None:
        invocation = self._create_invocation(tags="", notes="")

        result = IssueNotificationData.from_action_invocation(invocation)

        assert result.source == NotificationSource.ISSUE_ALERT
        assert isinstance(invocation.event_data.event, GroupEvent)
        assert result.event_id == invocation.event_data.event.event_id
        assert result.tags == set()
        assert result.notes == ""
        assert result.rule is not None


class IssueAlertNotificationTemplateTest(TestCase):
    def test_render_example(self) -> None:
        template = IssueAlertNotificationTemplate()
        result = template.render_example()
        assert isinstance(result, NotificationRenderedTemplate)
        assert result.subject == "Issue Alert"

    def test_hide_from_debugger(self) -> None:
        assert IssueAlertNotificationTemplate.hide_from_debugger is True


class IssueSlackRendererTest(IssueAlertInvocationMixin):
    def test_render_raises_on_invalid_data(self) -> None:
        from sentry.notifications.platform.templates.seer import SeerAutofixError

        invalid_data = SeerAutofixError(error_message="test")
        rendered_template = NotificationRenderedTemplate(subject="test", body=[])

        with pytest.raises(ValueError, match="does not support"):
            IssueSlackRenderer.render(
                data=invalid_data,
                rendered_template=rendered_template,
            )

    def _build_expected_blocks(
        self,
        *,
        group: Group,
        workflow_id: int,
        title: str = "test event",
        notes: str | None = None,
        tags_text: str | None = None,
    ) -> SlackRenderable:
        """Build the expected SlackRenderable for a rendered issue alert."""
        org_slug = self.organization.slug
        org_id = self.organization.id
        project_slug = self.project.slug
        project_id = self.project.id
        group_id = group.id
        block_id = json.dumps({"issue": group_id, "rule": workflow_id})

        issue_url = (
            f"http://testserver/organizations/{org_slug}/issues/{group_id}/"
            f"?referrer=slack&notification_uuid=test-uuid"
            f"&workflow_id={workflow_id}&alert_type=issue"
        )
        alert_url = f"http://testserver/organizations/{org_slug}/monitors/alerts/{workflow_id}/"
        project_url = f"http://testserver/organizations/{org_slug}/issues/?project={project_id}"

        blocks: list[Any] = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f":red_circle: <{issue_url}|*{title}*>",
                },
                "block_id": block_id,
            },
        ]

        if tags_text:
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": tags_text},
                    "block_id": json.dumps(
                        {"issue": group_id, "rule": workflow_id, "block": "tags"},
                    ),
                }
            )

        blocks.append(
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": "State: *New*   First Seen: *Just now*"}],
            }
        )

        blocks.append(
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Resolve"},
                        "action_id": f"status::{org_id}::{project_id}",
                        "value": "resolved",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Archive"},
                        "action_id": f"archive_dialog::{org_id}::{project_id}",
                        "value": "archive_dialog",
                    },
                    {
                        "type": "external_select",
                        "placeholder": {
                            "type": "plain_text",
                            "text": "Select Assignee...",
                            "emoji": True,
                        },
                        "action_id": f"assign::{org_id}::{project_id}",
                    },
                ],
            }
        )

        if notes:
            blocks.append(
                {"type": "section", "text": {"type": "mrkdwn", "text": f"notes: {notes}"}}
            )

        blocks.append(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": (
                            f"Project: <{project_url}|{project_slug}>"
                            f"    Alert: <{alert_url}|Test Detector>"
                            f"    Short ID: {group.qualified_short_id}"
                        ),
                    }
                ],
            }
        )

        blocks.append({"type": "divider"})

        return SlackRenderable(
            blocks=blocks,
            text=f"[{project_slug}] {title}",
        )

    @patch(
        "sentry.integrations.slack.message_builder.issues.fetch_issue_summary",
        return_value=None,
    )
    def test_render_produces_blocks(self, mock_summary: Any) -> None:
        invocation = self._create_invocation()
        data = IssueNotificationData.from_action_invocation(invocation)
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueSlackRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_blocks(
            group=invocation.event_data.group,
            workflow_id=getattr(invocation.action, "workflow_id"),
        )

    @patch(
        "sentry.integrations.slack.message_builder.issues.fetch_issue_summary",
        return_value=None,
    )
    def test_render_with_notes(self, mock_summary: Any) -> None:
        invocation = self._create_invocation(notes="important note")
        data = IssueNotificationData.from_action_invocation(invocation)
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueSlackRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_blocks(
            group=invocation.event_data.group,
            workflow_id=getattr(invocation.action, "workflow_id"),
            notes="important note",
        )

    @patch(
        "sentry.integrations.slack.message_builder.issues.fetch_issue_summary",
        return_value=None,
    )
    def test_render_with_tags(self, mock_summary: Any) -> None:
        invocation = self._create_invocation(
            tags="level",
            event_data={"message": "tagged event", "level": "error"},
        )
        data = IssueNotificationData.from_action_invocation(invocation)
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueSlackRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_blocks(
            group=invocation.event_data.group,
            workflow_id=getattr(invocation.action, "workflow_id"),
            title="tagged event",
            tags_text="level: `error`  ",
        )


class IssueAlertProviderDispatchTest(TestCase):
    def test_provider_returns_issue_alert_renderer(self) -> None:
        data = IssueNotificationData(group_id=self.group.id)
        renderer = SlackNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.ISSUE_ALERT,
        )
        assert renderer is IssueSlackRenderer

    def test_provider_returns_default_for_unknown_category(self) -> None:
        data = IssueNotificationData(group_id=self.group.id)
        renderer = SlackNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.DEBUG,
        )
        assert renderer is SlackNotificationProvider.default_renderer
