from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.message_builder import build_attachment_text
from sentry.integrations.msteams.card_builder import MSTEAMS_URL_FORMAT, ColumnSetBlock, TextBlock
from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.models import Team, User
from sentry.notifications.notifications.activity.base import GroupActivityNotification
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.integrations import ExternalProviders

from .block import (
    TextSize,
    TextWeight,
    create_column_set_block,
    create_footer_column_block,
    create_footer_logo_block,
    create_footer_text_block,
    create_text_block,
)


class MSTeamsNotificationsMessageBuilder(MSTeamsMessageBuilder):
    def __init__(
        self, notification: BaseNotification, context: Mapping[str, Any], recipient: Team | User
    ):
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def create_footer_block(self) -> ColumnSetBlock | None:
        footer_text = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.MSTEAMS
        )

        if footer_text:
            footer = create_footer_text_block(footer_text)

            return create_column_set_block(
                create_footer_logo_block(),
                create_footer_column_block(footer),
            )

        return None

    def create_attachment_title_block(self) -> TextBlock:
        title = self.notification.build_attachment_title(self.recipient)
        title_link = self.notification.get_title_link(self.recipient, ExternalProviders.MSTEAMS)

        return create_text_block(
            MSTEAMS_URL_FORMAT.format(text=title, url=title_link),
            size=TextSize.LARGE,
            weight=TextWeight.BOLDER,
        )

    def create_title_block(self) -> TextBlock:
        return create_text_block(
            self.notification.get_notification_title(ExternalProviders.MSTEAMS, self.context),
            size=TextSize.LARGE,
        )

    def create_description_block(self) -> TextBlock:
        return create_text_block(
            self.notification.get_message_description(self.recipient, ExternalProviders.MSTEAMS),
            size=TextSize.MEDIUM,
        )

    def build_notification_card(self):
        fields = [self.create_attachment_title_block(), self.create_description_block()]

        # TODO: Add support for notification actions.
        return super().build(
            title=self.create_title_block(),
            fields=fields,
            footer=self.create_footer_block(),
        )


class MSTeamsIssueNotificationsMessageBuilder(MSTeamsNotificationsMessageBuilder):
    def __init__(
        self,
        notification: GroupActivityNotification,
        context: Mapping[str, Any],
        recipient: Team | User,
    ):
        super().__init__(notification, context, recipient)
        self.group = getattr(notification, "group", None)

    def create_description_block(self) -> TextBlock | None:
        return (
            create_text_block(
                build_attachment_text(self.group),
                size=TextSize.MEDIUM,
            )
            if self.group
            else None
        )
