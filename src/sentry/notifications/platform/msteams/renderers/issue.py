from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import TYPE_CHECKING

from sentry import eventstore
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
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

if TYPE_CHECKING:
    from sentry.integrations.msteams.card_builder.block import (
        Action,
        Block,
        ColumnSetBlock,
        TextBlock,
    )


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
            except Exception:
                raise NotificationRenderError(f"Failed to retrieve event {data.event_id}")

        rules = [data.rule.to_rule()] if data.rule else []
        issue_url = cls.build_issue_url(group=group, notification_uuid=data.notification_uuid)

        fields: list[Block | None] = [
            cls.build_description(group=group, event=event),
            cls.build_footer(group=group, event=event, rules=rules),
            cls.build_assignee_note(group),
        ]

        return MSTeamsMessageBuilder().build(
            title=cls.build_title(group=group, issue_url=issue_url),
            fields=fields,
            actions=cls.build_actions(issue_url=issue_url),
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

        assignee = group.get_assignee()
        if assignee:
            assignee_text = format_actor_option_non_slack(assignee)["text"]
            return create_text_block(
                IssueConstants.ASSIGNEE_NOTE.format(assignee=assignee_text),
                size=TextSize.SMALL,
            )
        return None

    @classmethod
    def build_actions(cls, *, issue_url: str) -> list[Action]:
        from sentry.integrations.msteams.card_builder.block import ActionType, OpenUrlAction

        return [OpenUrlAction(type=ActionType.OPEN_URL, title="View Issue", url=issue_url)]
