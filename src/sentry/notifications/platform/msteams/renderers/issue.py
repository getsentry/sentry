from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sentry import eventstore
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.platform.msteams.provider import MSTeamsRenderable
from sentry.notifications.platform.registry import renderer_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.service import NotificationRenderError
from sentry.notifications.platform.templates.issue import IssueNotificationData
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.types.actor import Actor

if TYPE_CHECKING:
    from sentry.integrations.msteams.card_builder.block import (
        Action,
        Block,
        ColumnSetBlock,
        ContainerBlock,
        TextBlock,
    )
    from sentry.integrations.msteams.utils import ACTION_TYPE


@renderer_registry.register(NotificationProviderKey.MSTEAMS, sources=[NotificationSource.ISSUE])
class IssueMSTeamsRenderer(NotificationRenderer[MSTeamsRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> MSTeamsRenderable:
        if not isinstance(data, IssueNotificationData):
            raise ValueError(f"IssueMSTeamsRenderer does not support {data.__class__.__name__}")

        from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder

        # Retrieving Group and Event data is an anti-pattern, do not do this
        # in permanent renderers.
        try:
            group = Group.objects.get_from_cache(id=data.group_id)
        except Group.DoesNotExist:
            raise NotificationRenderError(f"Group {data.group_id} not found")

        event = None
        if data.event_id:
            try:
                event = eventstore.backend.get_event_by_id(
                    project_id=group.project.id,
                    event_id=data.event_id,
                    group_id=data.group_id,
                )
                if isinstance(event, Event):
                    event = event.for_group(group)
            except Exception:
                raise NotificationRenderError(f"Failed to retrieve event {data.event_id}")

        rules = [data.rule.to_rule()] if data.rule else []
        issue_url = cls.build_issue_url(group=group, notification_uuid=data.notification_uuid)

        fields: list[Block | None] = [
            cls.build_description(group=group, event=event),
            cls.build_footer(group=group, event=event, rules=rules),
            cls.build_assignee_note(group),
            cls.build_actions(group=group, data=data, rules=rules),
        ]

        return MSTeamsMessageBuilder().build(
            title=cls.build_title(group=group, issue_url=issue_url),
            fields=fields,
        )

    @classmethod
    def build_issue_url(cls, *, group: Group, notification_uuid: str) -> str:
        params: dict[str, str] = {"referrer": IntegrationProviderSlug.MSTEAMS.value}
        if notification_uuid:
            params["notification_uuid"] = notification_uuid
        return group.get_absolute_url(params=params)

    @classmethod
    def build_title(cls, *, group: Group, issue_url: str) -> TextBlock:
        from sentry.integrations.messaging.message_builder import build_attachment_title
        from sentry.integrations.msteams.card_builder.block import (
            TextSize,
            TextWeight,
            create_text_block,
        )

        title_text = build_attachment_title(group)
        return create_text_block(
            f"[{title_text}]({issue_url})",
            size=TextSize.LARGE,
            weight=TextWeight.BOLDER,
        )

    @classmethod
    def build_description(
        cls, *, group: Group, event: Event | GroupEvent | None
    ) -> TextBlock | None:
        from sentry.integrations.messaging.message_builder import build_attachment_text
        from sentry.integrations.msteams.card_builder.block import (
            TextSize,
            TextWeight,
            create_text_block,
        )

        text = build_attachment_text(group, event)
        if text:
            return create_text_block(text, size=TextSize.MEDIUM, weight=TextWeight.BOLDER)
        return None

    @classmethod
    def build_footer(
        cls,
        *,
        group: Group,
        event: Event | GroupEvent | None,
        rules: Sequence[Rule],
    ) -> ColumnSetBlock:
        from sentry.integrations.messaging.message_builder import build_footer
        from sentry.integrations.msteams.card_builder import MSTEAMS_URL_FORMAT
        from sentry.integrations.msteams.card_builder.block import (
            ContentAlignment,
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

        project = Project.objects.get_from_cache(id=group.project_id)
        footer_text = build_footer(
            group=group, project=project, url_format=MSTEAMS_URL_FORMAT, rules=rules
        )

        ts: datetime = group.last_seen
        date = max(ts, event.datetime) if event else ts
        date_str = date.replace(microsecond=0).isoformat()

        return create_column_set_block(
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

    @classmethod
    def build_assignee_note(cls, group: Group) -> TextBlock | None:
        from sentry.integrations.messaging.message_builder import format_actor_option_non_slack
        from sentry.integrations.msteams.card_builder.block import TextSize, create_text_block
        from sentry.integrations.msteams.card_builder.utils import IssueConstants

        try:
            assignee = group.get_assignee()
        except Actor.InvalidActor:
            assignee = None
        if assignee:
            assignee_text = format_actor_option_non_slack(assignee)["text"]
            return create_text_block(
                IssueConstants.ASSIGNEE_NOTE.format(assignee=assignee_text),
                size=TextSize.SMALL,
            )
        return None

    @classmethod
    def build_action_payload(
        cls, *, action_type: ACTION_TYPE, data: IssueNotificationData, rules: Sequence[Rule]
    ) -> dict[str, Any]:
        # Teams posts this back to the webhook when the action is used, and only handles it
        # correctly when the contents are nested under a `payload` key.
        return {
            "payload": {
                "actionType": action_type,
                "groupId": data.group_id,
                "eventId": data.event_id,
                "rules": [rule.id for rule in rules],
            }
        }

    @classmethod
    def build_action(
        cls,
        *,
        toggled: bool,
        action: ACTION_TYPE,
        action_title: str,
        reverse_action: ACTION_TYPE,
        reverse_action_title: str,
        data: IssueNotificationData,
        rules: Sequence[Rule],
        **card_kwargs: Any,
    ) -> Action:
        """
        Build the action for a state the issue is not currently in. An issue which is not resolved
        gets a Resolve button revealing a card of options, and a resolved one gets an Unresolve
        button which submits directly.
        """
        from sentry.integrations.msteams.card_builder.block import (
            ActionType,
            ShowCardAction,
            SubmitAction,
        )
        from sentry.integrations.msteams.card_builder.issues import MSTeamsIssueMessageBuilder

        if toggled:
            return SubmitAction(
                type=ActionType.SUBMIT,
                title=reverse_action_title,
                data=cls.build_action_payload(action_type=reverse_action, data=data, rules=rules),
            )

        card = MSTeamsIssueMessageBuilder.build_input_choice_card(
            data=cls.build_action_payload(action_type=action, data=data, rules=rules),
            **card_kwargs,
        )
        return ShowCardAction(type=ActionType.SHOW_CARD, title=action_title, card=card)

    @classmethod
    def build_assignee_choices(cls, group: Group) -> Sequence[tuple[str, str]]:
        from sentry.integrations.messaging.message_builder import format_actor_options_non_slack
        from sentry.integrations.msteams.card_builder import ME

        teams = group.project.teams.all().order_by("slug")
        return [("Me", ME)] + [
            (team["text"], team["value"]) for team in format_actor_options_non_slack(teams)
        ]

    @classmethod
    def build_actions(
        cls, *, group: Group, data: IssueNotificationData, rules: Sequence[Rule]
    ) -> ContainerBlock:
        from sentry.integrations.msteams.card_builder import ME
        from sentry.integrations.msteams.card_builder.block import (
            create_action_set_block,
            create_container_block,
        )
        from sentry.integrations.msteams.card_builder.utils import IssueConstants
        from sentry.integrations.msteams.utils import ACTION_TYPE

        status = group.get_status()

        resolve_action = cls.build_action(
            toggled=GroupStatus.RESOLVED == status,
            action=ACTION_TYPE.RESOLVE,
            action_title=IssueConstants.RESOLVE,
            reverse_action=ACTION_TYPE.UNRESOLVE,
            reverse_action_title=IssueConstants.UNRESOLVE,
            data=data,
            rules=rules,
            card_title=IssueConstants.RESOLVE,
            submit_button_title=IssueConstants.RESOLVE,
            input_id=IssueConstants.RESOLVE_INPUT_ID,
            choices=IssueConstants.RESOLVE_INPUT_CHOICES,
        )

        archive_action = cls.build_action(
            toggled=GroupStatus.IGNORED == status,
            action=ACTION_TYPE.ARCHIVE,
            action_title=IssueConstants.ARCHIVE,
            reverse_action=ACTION_TYPE.UNRESOLVE,
            reverse_action_title=IssueConstants.UNARCHIVE,
            data=data,
            rules=rules,
            card_title=IssueConstants.ARCHIVE_INPUT_TITLE,
            submit_button_title=IssueConstants.ARCHIVE,
            input_id=IssueConstants.ARCHIVE_INPUT_ID,
            choices=IssueConstants.ARCHIVE_INPUT_CHOICES,
        )

        assign_action = cls.build_action(
            toggled=group.get_assignee() is not None,
            action=ACTION_TYPE.ASSIGN,
            action_title=IssueConstants.ASSIGN,
            reverse_action=ACTION_TYPE.UNASSIGN,
            reverse_action_title=IssueConstants.UNASSIGN,
            data=data,
            rules=rules,
            card_title=IssueConstants.ASSIGN_INPUT_TITLE,
            submit_button_title=IssueConstants.ASSIGN,
            input_id=IssueConstants.ASSIGN_INPUT_ID,
            choices=cls.build_assignee_choices(group),
            default_choice=ME,
        )

        return create_container_block(
            create_action_set_block(resolve_action, archive_action, assign_action)
        )
