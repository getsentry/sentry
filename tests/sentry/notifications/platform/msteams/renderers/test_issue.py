from __future__ import annotations

from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest

from sentry import eventstore
from sentry.integrations.messaging.message_builder import (
    build_attachment_title,
    build_footer,
    format_actor_options_non_slack,
)
from sentry.integrations.msteams.card_builder import ME, MSTEAMS_URL_FORMAT
from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import (
    Action,
    ActionType,
    AdaptiveCard,
    Block,
    ContentAlignment,
    ShowCardAction,
    SubmitAction,
    TextSize,
    TextWeight,
    create_action_set_block,
    create_column_block,
    create_column_set_block,
    create_container_block,
    create_footer_column_block,
    create_footer_logo_block,
    create_footer_text_block,
    create_text_block,
)
from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder
from sentry.integrations.msteams.card_builder.utils import IssueConstants
from sentry.integrations.msteams.utils import ACTION_TYPE
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.models.group import Group, GroupStatus
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
from sentry.types.actor import Actor


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

        def payload(action_type: ACTION_TYPE) -> dict[str, Any]:
            return {
                "payload": {
                    "actionType": action_type,
                    "groupId": group.id,
                    "eventId": event.event_id,
                    "rules": [1],
                }
            }

        teams = group.project.teams.all().order_by("slug")
        assignee_choices = [("Me", ME)] + [
            (team["text"], team["value"]) for team in format_actor_options_non_slack(teams)
        ]

        assign_action: Action
        if assignee:
            assign_action = SubmitAction(
                type=ActionType.SUBMIT,
                title=IssueConstants.UNASSIGN,
                data=payload(ACTION_TYPE.UNASSIGN),
            )
        else:
            assign_action = ShowCardAction(
                type=ActionType.SHOW_CARD,
                title=IssueConstants.ASSIGN,
                card=MSTeamsIssueMessageBuilder.build_input_choice_card(
                    data=payload(ACTION_TYPE.ASSIGN),
                    card_title=IssueConstants.ASSIGN_INPUT_TITLE,
                    submit_button_title=IssueConstants.ASSIGN,
                    input_id=IssueConstants.ASSIGN_INPUT_ID,
                    choices=assignee_choices,
                    default_choice=ME,
                ),
            )

        actions = create_container_block(
            create_action_set_block(
                ShowCardAction(
                    type=ActionType.SHOW_CARD,
                    title=IssueConstants.RESOLVE,
                    card=MSTeamsIssueMessageBuilder.build_input_choice_card(
                        data=payload(ACTION_TYPE.RESOLVE),
                        card_title=IssueConstants.RESOLVE,
                        submit_button_title=IssueConstants.RESOLVE,
                        input_id=IssueConstants.RESOLVE_INPUT_ID,
                        choices=IssueConstants.RESOLVE_INPUT_CHOICES,
                    ),
                ),
                ShowCardAction(
                    type=ActionType.SHOW_CARD,
                    title=IssueConstants.ARCHIVE,
                    card=MSTeamsIssueMessageBuilder.build_input_choice_card(
                        data=payload(ACTION_TYPE.ARCHIVE),
                        card_title=IssueConstants.ARCHIVE_INPUT_TITLE,
                        submit_button_title=IssueConstants.ARCHIVE,
                        input_id=IssueConstants.ARCHIVE_INPUT_ID,
                        choices=IssueConstants.ARCHIVE_INPUT_CHOICES,
                    ),
                ),
                assign_action,
            )
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
        fields.append(actions)

        return MSTeamsMessageBuilder().build(title=title, fields=fields)

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

    def _card_actions(self, card: AdaptiveCard) -> list[Any]:
        container = cast(Any, card["body"][-1])
        return cast(list[Any], container["items"][0]["actions"])

    def test_render_offers_reverse_actions_for_resolved_issue(self) -> None:
        data, _, group = self._create_data()
        group.update(status=GroupStatus.RESOLVED, substatus=None)

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
        )

        actions = self._card_actions(result)
        assert [action["title"] for action in actions] == [
            IssueConstants.UNRESOLVE,
            IssueConstants.ARCHIVE,
            IssueConstants.ASSIGN,
        ]

        resolve_action = actions[0]
        assert resolve_action["type"] == ActionType.SUBMIT
        assert resolve_action["data"]["payload"]["actionType"] == ACTION_TYPE.UNRESOLVE
        assert "integrationId" not in resolve_action["data"]["payload"]

    def test_render_offers_unassign_for_assigned_issue(self) -> None:
        data, _, group = self._create_data()
        GroupAssignee.objects.assign(group, self.user)

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
        )

        assign_action = self._card_actions(result)[-1]
        assert assign_action["type"] == ActionType.SUBMIT
        assert assign_action["title"] == IssueConstants.UNASSIGN
        assert assign_action["data"]["payload"]["actionType"] == ACTION_TYPE.UNASSIGN

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

    def test_render_uses_triggering_event_description(self) -> None:
        data, _, group = self._create_data(
            event_data={
                "exception": {
                    "values": [{"type": "ValueError", "value": "triggering event"}],
                },
                "fingerprint": ["same-issue"],
            },
        )
        latest_event = self.store_event(
            data={
                "exception": {
                    "values": [{"type": "ValueError", "value": "latest event"}],
                },
                "fingerprint": ["same-issue"],
            },
            project_id=self.project.id,
        )
        assert latest_event.group_id == group.id

        result = IssueMSTeamsRenderer.render(
            data=data,
            rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
        )

        assert result["body"][1] == create_text_block(
            "triggering event", size=TextSize.MEDIUM, weight=TextWeight.BOLDER
        )

    def test_render_with_generic_issue_description(self) -> None:
        data, event, group = self._create_data()
        group_event = event.for_group(group)
        occurrence = MagicMock(spec=IssueOccurrence)
        occurrence.important_evidence_display = IssueEvidence(
            name="Evidence", value="generic issue description", important=True
        )
        group_event.occurrence = occurrence

        with (
            patch.object(eventstore.backend, "get_event_by_id", return_value=event),
            patch.object(event, "for_group", return_value=group_event) as for_group,
        ):
            result = IssueMSTeamsRenderer.render(
                data=data,
                rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
            )

        for_group.assert_called_once_with(group)
        assert result["body"][1] == create_text_block(
            "generic issue description", size=TextSize.MEDIUM, weight=TextWeight.BOLDER
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

    def test_render_with_stale_assignee(self) -> None:
        data, event, group = self._create_data()

        with patch.object(
            Group, "get_assignee", side_effect=Actor.InvalidActor("Assignee no longer exists")
        ):
            result = IssueMSTeamsRenderer.render(
                data=data,
                rendered_template=NotificationRenderedTemplate(subject="Issue Alert", body=[]),
            )

        assert result == self._build_expected_card(group=group, event=event)

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
