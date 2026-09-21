from __future__ import annotations

from typing import Any

import pytest

from sentry.integrations.messaging.message_builder import build_attachment_title, build_footer
from sentry.integrations.msteams.card_builder import MSTEAMS_URL_FORMAT
from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import (
    Action,
    ActionType,
    AdaptiveCard,
    Block,
    ContentAlignment,
    OpenUrlAction,
    TextSize,
    TextWeight,
    create_column_block,
    create_column_set_block,
    create_footer_column_block,
    create_footer_logo_block,
    create_footer_text_block,
    create_text_block,
)
from sentry.integrations.msteams.card_builder.utils import IssueConstants
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.project import Project
from sentry.notifications.platform.msteams.provider import (
    MSTeamsNotificationProvider,
)
from sentry.notifications.platform.msteams.renderers.issue import IssueMSTeamsRenderer
from sentry.notifications.platform.service import NotificationRenderError
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    SerializableRuleProxy,
)
from sentry.notifications.platform.types import (
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.notifications.platform import MockNotification


class IssueMSTeamsRendererTest(TestCase):
    def _create_data(
        self,
        *,
        tags: list[str] | None = None,
        event_data: dict[str, Any] | None = None,
    ) -> tuple[IssueNotificationData, Any, Group]:
        event = self.store_event(
            data=event_data or {"message": "test event"},
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        data = IssueNotificationData(
            group_id=group.id,
            event_id=event.event_id,
            notification_uuid="test-uuid",
            tags=tags,
            rule=SerializableRuleProxy(
                id=1,
                label="Test Detector",
                data={
                    "actions": [{"workflow_id": 1}],
                },
                project_id=self.project.id,
            ),
        )

        return data, event, group

    def _build_expected_card(
        self,
        *,
        group: Group,
        event: Any,
        notification_uuid: str = "test-uuid",
        description: str | None = None,
        assignee: str | None = None,
    ) -> AdaptiveCard:
        title_text = build_attachment_title(group)
        issue_url = group.get_absolute_url(
            params={"referrer": "msteams", "notification_uuid": notification_uuid}
        )

        title = create_text_block(
            f"[{title_text}]({issue_url})",
            size=TextSize.LARGE,
            weight=TextWeight.BOLDER,
        )

        project = Project.objects.get_from_cache(id=group.project_id)
        rules = [
            SerializableRuleProxy(
                id=1,
                label="Test Detector",
                data={"actions": [{"workflow_id": 1}]},
                project_id=self.project.id,
            ).to_rule()
        ]
        footer_text = build_footer(
            group=group, project=project, url_format=MSTEAMS_URL_FORMAT, rules=rules
        )

        from datetime import datetime

        ts: datetime = group.last_seen
        date = max(ts, event.datetime) if event else ts
        date_str = date.replace(microsecond=0).isoformat()

        footer = create_column_set_block(
            create_column_block(create_footer_logo_block()),
            create_footer_column_block(create_footer_text_block(footer_text)),
            create_column_block(
                create_text_block(
                    IssueConstants.DATE_FORMAT.format(date=date_str),
                    size=TextSize.SMALL,
                    weight=TextWeight.LIGHTER,
                    horizontalAlignment=ContentAlignment.CENTER,
                    wrap=False,
                ),
                verticalContentAlignment=ContentAlignment.CENTER,
            ),
        )

        fields: list[Block | None] = []
        if description:
            fields.append(
                create_text_block(description, size=TextSize.MEDIUM, weight=TextWeight.BOLDER)
            )
        fields.append(footer)
        if assignee:
            fields.append(
                create_text_block(
                    IssueConstants.ASSIGNEE_NOTE.format(assignee=assignee), size=TextSize.SMALL
                )
            )

        actions: list[Action] = [
            OpenUrlAction(type=ActionType.OPEN_URL, title="View Issue", url=issue_url)
        ]

        return MSTeamsMessageBuilder().build(title=title, fields=fields, actions=actions)

    def test_render_raises_on_invalid_data(self) -> None:
        from sentry.notifications.platform.templates.seer import SeerAutofixError

        invalid_data = SeerAutofixError(error_message="test")
        rendered_template = NotificationRenderedTemplate(subject="test", body=[])

        with pytest.raises(ValueError, match="does not support"):
            IssueMSTeamsRenderer.render(
                data=invalid_data,
                rendered_template=rendered_template,
            )

    def test_render_produces_card(self) -> None:
        data, event, group = self._create_data()
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_card(group=group, event=event)

    def test_render_with_tags(self) -> None:
        data, event, group = self._create_data(
            tags=["level"],
            event_data={"message": "tagged event", "level": "error"},
        )
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        # Tags are not rendered in the MS Teams card (unlike Slack/Discord)
        # since the card builder doesn't use them. The card should still render.
        assert result == self._build_expected_card(group=group, event=event)

    def test_render_with_description(self) -> None:
        data, event, group = self._create_data(
            event_data={
                "exception": {
                    "values": [{"type": "ValueError", "value": "something went wrong"}],
                },
            },
        )
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_card(
            group=group, event=event, description="something went wrong"
        )

    def test_render_with_assignee(self) -> None:
        data, event, group = self._create_data()
        GroupAssignee.objects.assign(group, self.user)
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert result == self._build_expected_card(
            group=group, event=event, assignee=self.user.get_display_name()
        )

    def test_render_group_not_found(self) -> None:
        data = IssueNotificationData(
            group_id=999999999,
            notification_uuid="test-uuid",
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
        )
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        with pytest.raises(NotificationRenderError, match="Group 999999999 not found"):
            IssueMSTeamsRenderer.render(
                data=data,
                rendered_template=rendered_template,
            )

    def test_source(self) -> None:
        data = IssueNotificationData(
            group_id=self.group.id,
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
        )
        assert data.source == NotificationSource.ISSUE


class IssueMSTeamsProviderDispatchTest(TestCase):
    def test_provider_returns_issue_renderer(self) -> None:
        data = IssueNotificationData(
            group_id=self.group.id,
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
        )
        renderer = MSTeamsNotificationProvider.get_renderer(data=data)
        assert renderer is IssueMSTeamsRenderer

    def test_provider_returns_default_for_unregistered_source(self) -> None:
        data = MockNotification(message="test")
        renderer = MSTeamsNotificationProvider.get_renderer(data=data)
        assert renderer is MSTeamsNotificationProvider.default_renderer
