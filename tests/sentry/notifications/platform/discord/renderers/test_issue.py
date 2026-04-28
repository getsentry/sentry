from __future__ import annotations

from typing import Any

import pytest

from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.models.group import Group
from sentry.notifications.platform.discord.provider import (
    DiscordNotificationProvider,
)
from sentry.notifications.platform.discord.renderers.issue import IssueDiscordRenderer
from sentry.notifications.platform.templates.issue import (
    IssueNotificationData,
    SerializableRuleProxy,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase


class IssueDiscordRendererTest(TestCase):
    def _create_data(
        self,
        *,
        tags: list[str] | None = None,
        event_data: dict[str, Any] | None = None,
    ) -> tuple[IssueNotificationData, Event, Group]:
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

    def test_render_raises_on_invalid_data(self) -> None:
        from sentry.notifications.platform.templates.seer import SeerAutofixError

        invalid_data = SeerAutofixError(error_message="test")
        rendered_template = NotificationRenderedTemplate(subject="test", body=[])

        with pytest.raises(ValueError, match="does not support"):
            IssueDiscordRenderer.render(
                data=invalid_data,
                rendered_template=rendered_template,
            )

    def test_render_produces_message(self) -> None:
        data, event, group = self._create_data()
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueDiscordRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert isinstance(result, dict)
        assert "content" in result
        assert "embeds" in result
        assert "components" in result
        assert len(result["embeds"]) == 1
        assert len(result["components"]) >= 1

        embed = result["embeds"][0]
        assert embed.get("title") == "test event"
        url = embed.get("url")
        assert (
            url is not None
            and f"{self.organization.slug}/issues/{group.id}/events/{event.event_id}/?referrer=discord&workflow_id=1&alert_type=issue"
            in url
        )
        color = embed.get("color")
        assert color is not None and color == LEVEL_TO_COLOR["error"]
        footer = embed.get("footer")
        assert footer is not None and footer == {
            "text": f"{group.qualified_short_id} via Test Detector"
        }

    def test_render_with_tags(self) -> None:
        data, _, _ = self._create_data(
            tags=["level"],
            event_data={"message": "tagged event", "level": "error"},
        )
        rendered_template = NotificationRenderedTemplate(subject="Issue Alert", body=[])

        result = IssueDiscordRenderer.render(
            data=data,
            rendered_template=rendered_template,
        )

        assert isinstance(result, dict)
        embed = result["embeds"][0]
        assert "fields" in embed
        fields = embed["fields"]
        assert any(f["name"] == "level" for f in fields)

    def test_source(self) -> None:
        data = IssueNotificationData(
            group_id=self.group.id,
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
        )
        assert data.source == NotificationSource.ISSUE


class IssueAlertProviderDispatchTest(TestCase):
    def test_provider_returns_issue_renderer(self) -> None:
        data = IssueNotificationData(
            group_id=self.group.id,
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
        )
        renderer = DiscordNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.ISSUE,
        )
        assert renderer is IssueDiscordRenderer

    def test_provider_returns_default_for_unknown_category(self) -> None:
        data = IssueNotificationData(
            group_id=self.group.id,
            rule=SerializableRuleProxy(
                id=1, label="Test Detector", data={}, project_id=self.project.id
            ),
            tags=["environment", "level"],
        )
        renderer = DiscordNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.DEBUG,
        )
        assert renderer is DiscordNotificationProvider.default_renderer
