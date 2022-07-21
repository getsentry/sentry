from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.msteams.card_builder import MSTEAMS_URL_FORMAT, ColumnSetBlock, TextBlock
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.integrations import ExternalProviders

from .block import TextSize, TextWeight, create_column_set_block, create_text_block
from .issues import MSTeamsIssueMessageBuilder


class MSTeamsNotificationsMessageBuilder(MSTeamsIssueMessageBuilder):
    def __init__(
        self, notification: BaseNotification, context: Mapping[str, Any], recipient: Team | User
    ):
        self.notification = notification
        self.context = context
        self.recipient = recipient

        super().__init__(self.notification.group, None, None, None)

    def create_footer_block(self) -> ColumnSetBlock | None:
        footer_text = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.MSTEAMS, MSTEAMS_URL_FORMAT
        )

        if footer_text:
            footer = self.create_footer_text_block(footer_text)

            return create_column_set_block(
                self.create_footer_logo_block(),
                self.create_footer_column_block(footer),
            )

        return None

    def build_attachment_title_block(self) -> TextBlock:
        title = self.notification.build_attachment_title(self.recipient)
        title_link = self.notification.get_title_link(self.recipient)

        return create_text_block(
            MSTEAMS_URL_FORMAT.format(text=title, url=title_link),
            size=TextSize.LARGE,
            weight=TextWeight.BOLDER,
        )

    def build_notification_card(self):
        title_block = create_text_block(
            self.notification.get_notification_title(self.context),
            size=TextSize.LARGE,
        )

        description_block = create_text_block(
            self.notification.get_message_description(self.recipient),
            size=TextSize.MEDIUM,
        )

        fields = [self.build_attachment_title_block(), description_block]

        # TODO: Add support for notification actions.
        return super().build(
            title=title_block,
            fields=fields,
            footer=self.create_footer_block(),
        )
