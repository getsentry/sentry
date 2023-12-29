from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, List, Sequence, Tuple

from sentry import features
from sentry.eventstore.models import Event
from sentry.integrations.message_builder import (
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_option,
    format_actor_options,
)
from sentry.integrations.msteams.card_builder import ME, MSTEAMS_URL_FORMAT
from sentry.integrations.msteams.card_builder.block import (
    Action,
    AdaptiveCard,
    Block,
    ColumnSetBlock,
    ContainerBlock,
    ShowCardAction,
    SubmitAction,
    TextBlock,
)
from sentry.integrations.msteams.card_builder.utils import IssueConstants
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.services.hybrid_cloud.integration import RpcIntegration

from ..utils import ACTION_TYPE
from .base import MSTeamsMessageBuilder
from .block import (
    ActionType,
    ContentAlignment,
    TextSize,
    TextWeight,
    create_action_set_block,
    create_column_block,
    create_column_set_block,
    create_container_block,
    create_footer_column_block,
    create_footer_logo_block,
    create_footer_text_block,
    create_input_choice_set_block,
    create_text_block,
)

logger = logging.getLogger(__name__)


class MSTeamsIssueMessageBuilder(MSTeamsMessageBuilder):
    def __init__(
        self, group: Group, event: Event, rules: Sequence[Rule], integration: RpcIntegration
    ):
        self.group = group
        self.event = event
        self.rules = rules
        self.integration = integration

    def generate_action_payload(self, action_type: ACTION_TYPE) -> Any:
        # we need nested data or else Teams won't handle the payload correctly
        assert self.event.group is not None
        return {
            "payload": {
                "actionType": action_type,
                "groupId": self.event.group.id,
                "eventId": self.event.event_id,
                "rules": [rule.id for rule in self.rules],
                "integrationId": self.integration.id,
            }
        }

    def build_group_title(self, notification_uuid: str | None = None) -> TextBlock:
        text = build_attachment_title(self.group)
        params = {"referrer": "msteams"}
        if notification_uuid:
            params.update({"notification_uuid": notification_uuid})
        link = self.group.get_absolute_url(params=params)

        title_text = f"[{text}]({link})"
        return create_text_block(
            title_text,
            size=TextSize.LARGE,
            weight=TextWeight.BOLDER,
        )

    def build_group_descr(self) -> TextBlock | None:
        # TODO: implement with event as well
        text = build_attachment_text(self.group)
        if text:
            return create_text_block(
                text,
                size=TextSize.MEDIUM,
                weight=TextWeight.BOLDER,
            )

        return None

    def get_timestamp(self) -> str:
        ts: datetime = self.group.last_seen

        date = max(ts, self.event.datetime) if self.event else ts

        # Adaptive cards is strict about the isoformat.
        date_str: str = date.replace(microsecond=0).isoformat()

        return date_str

    def create_date_block(self) -> TextBlock:
        date_str = self.get_timestamp()

        return create_text_block(
            IssueConstants.DATE_FORMAT.format(date=date_str),
            size=TextSize.SMALL,
            weight=TextWeight.LIGHTER,
            horizontalAlignment=ContentAlignment.CENTER,
            wrap=False,
        )

    def build_group_footer(self) -> ColumnSetBlock:
        project = Project.objects.get_from_cache(id=self.group.project_id)

        image_column = create_footer_logo_block()

        text = build_footer(self.group, project, self.rules, MSTEAMS_URL_FORMAT)

        text_column = create_footer_column_block(create_footer_text_block(text))

        date_column = create_column_block(
            self.create_date_block(),
            verticalContentAlignment=ContentAlignment.CENTER,
        )

        return create_column_set_block(
            create_column_block(image_column),
            text_column,
            date_column,
        )

    @staticmethod
    def build_input_choice_card(
        data: Any,
        card_title: str,
        input_id: str,
        submit_button_title: str,
        choices: Sequence[Tuple[str, Any]],
        default_choice: Any = None,
    ) -> AdaptiveCard:
        return MSTeamsMessageBuilder().build(
            title=create_text_block(card_title, weight=TextWeight.BOLDER),
            text=create_input_choice_set_block(
                id=input_id, choices=choices, default_choice=default_choice
            ),
            actions=[SubmitAction(type=ActionType.SUBMIT, title=submit_button_title, data=data)],
        )

    def create_issue_action_block(
        self,
        toggled: bool,
        action: ACTION_TYPE,
        action_title: str,
        reverse_action: ACTION_TYPE,
        reverse_action_title: str,
        **card_kwargs: Any,
    ) -> Action:
        """
        Build an action block for a particular `action` (Resolve).
        It could be one of the following depending on if the state is `toggled` (Resolved issue).
        If the issue is `toggled` then present a button with the `reverse_action` (Unresolve).
        If it is not `toggled` then present a button which reveals a card with options to
        perform the action ([Immediately, In current release, ...])
        """
        if toggled:
            data = self.generate_action_payload(reverse_action)
            return SubmitAction(type=ActionType.SUBMIT, title=reverse_action_title, data=data)

        data = self.generate_action_payload(action)
        card = self.build_input_choice_card(data=data, **card_kwargs)
        return ShowCardAction(type=ActionType.SHOW_CARD, title=action_title, card=card)

    def get_teams_choices(self) -> Sequence[Tuple[str, str]]:
        teams = self.group.project.teams.all().order_by("slug")
        return [("Me", ME)] + [
            (team["text"], team["value"]) for team in format_actor_options(teams)
        ]

    def build_group_actions(self) -> ContainerBlock:
        status = self.group.get_status()
        has_escalating = features.has(
            "organizations:escalating-issues-msteams", self.group.project.organization
        )

        resolve_action = self.create_issue_action_block(
            toggled=GroupStatus.RESOLVED == status,
            action=ACTION_TYPE.RESOLVE,
            action_title=IssueConstants.RESOLVE,
            reverse_action=ACTION_TYPE.UNRESOLVE,
            reverse_action_title=IssueConstants.UNRESOLVE,
            # card_kwargs
            card_title=IssueConstants.RESOLVE,
            submit_button_title=IssueConstants.RESOLVE,
            input_id=IssueConstants.RESOLVE_INPUT_ID,
            choices=IssueConstants.RESOLVE_INPUT_CHOICES,
        )

        ignore_action = self.create_issue_action_block(
            toggled=GroupStatus.IGNORED == status,
            action=ACTION_TYPE.IGNORE,
            action_title=IssueConstants.ARCHIVE if has_escalating else IssueConstants.IGNORE,
            reverse_action=ACTION_TYPE.UNRESOLVE,
            reverse_action_title=IssueConstants.STOP_ARCHIVE
            if has_escalating
            else IssueConstants.STOP_IGNORING,
            # card_kwargs
            card_title=IssueConstants.ARCHIVE_INPUT_TITLE
            if has_escalating
            else IssueConstants.IGNORE_INPUT_TITLE,
            submit_button_title=IssueConstants.ARCHIVE if has_escalating else IssueConstants.IGNORE,
            input_id=IssueConstants.IGNORE_INPUT_ID,
            choices=IssueConstants.ARCHIVE_INPUT_CHOICES
            if has_escalating
            else IssueConstants.IGNORE_INPUT_CHOICES,
        )

        teams_choices = self.get_teams_choices()

        assign_action = self.create_issue_action_block(
            toggled=self.group.get_assignee() is not None,
            action=ACTION_TYPE.ASSIGN,
            action_title=IssueConstants.ASSIGN,
            reverse_action=ACTION_TYPE.UNASSIGN,
            reverse_action_title=IssueConstants.UNASSIGN,
            # card_kwargs
            card_title=IssueConstants.ASSIGN_INPUT_TITLE,
            submit_button_title=IssueConstants.ASSIGN,
            input_id=IssueConstants.ASSIGN_INPUT_ID,
            choices=teams_choices,
            default_choice=ME,
        )

        logger.info(
            "msteams.build_group_actions",
            extra={
                "group_id": self.group.id,
                "project_id": self.group.project.id,
                "organization": self.group.project.organization.id,
                "has_escalating": has_escalating,
                "ignore_action": ignore_action,
            },
        )

        return create_container_block(
            create_action_set_block(
                resolve_action,
                ignore_action,
                assign_action,
            )
        )

    def build_assignee_note(self) -> TextBlock | None:
        assignee = self.group.get_assignee()
        if assignee:
            assignee_text = format_actor_option(assignee)["text"]

            return create_text_block(
                IssueConstants.ASSIGNEE_NOTE.format(assignee=assignee_text),
                size=TextSize.SMALL,
            )

        return None

    def build_group_card(self, notification_uuid: str | None = None) -> AdaptiveCard:
        """
        The issue (group) card has the following components stacked vertically,
        1. The issue title which links to the issue.
        2. A description of the issue if it is available. (Optional)
        3. A footer block, which again has 3 components stacked horizontally,
            3a. The short id of the group.
            3b. The alert rule(s) that fired this notification.
            3c. The date and time of the event.
        4. Details of the assignee if the issue is assigned to an actor. (Optional)
        5. A set of three actions, resolve, ignore and assign which can
            futher reveal cards with dropdowns for selecting options.
        """
        # Explicit typing to satisfy mypy.
        fields: List[Block | None] = [
            self.build_group_descr(),
            self.build_group_footer(),
            self.build_assignee_note(),
            self.build_group_actions(),
        ]

        return super().build(
            title=self.build_group_title(notification_uuid=notification_uuid),
            fields=fields,
        )
