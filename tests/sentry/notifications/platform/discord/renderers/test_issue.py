from __future__ import annotations

from typing import Any

import pytest

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
from sentry.testutils.cases import TestCase


class IssueDiscordRendererTest(TestCase):
    def _create_data(
        self,
        *,
        tags: str = "",
        event_data: dict[str, Any] | None = None,
    ) -> IssueNotificationData:
        event = self.store_event(
            data=event_data or {"message": "test event"},
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        return IssueNotificationData(
            group_id=group.id,
            event_id=event.event_id,
            notification_uuid="test-uuid",
            rule=SerializableRuleProxy(
                id=1,
                label="Test Detector",
                data={
                    "actions": [{"workflow_id": 1, "tags": tags}],
                },
                project_id=self.project.id,
            ),
        )

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
        data = self._create_data()
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
        assert "title" in embed
        assert "url" in embed
        assert "color" in embed
        assert "footer" in embed

    def test_render_with_tags(self) -> None:
        data = self._create_data(
            tags="level",
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
        )
        renderer = DiscordNotificationProvider.get_renderer(
            data=data,
            category=NotificationCategory.DEBUG,
        )
        assert renderer is DiscordNotificationProvider.default_renderer
