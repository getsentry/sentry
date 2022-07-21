from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.msteams.card_builder import MSTEAMS_URL_FORMAT, ColumnSetBlock
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.integrations import ExternalProviders

from .block import TextSize, create_column_set_block, create_text_block
from .issues import MSTeamsIssueMessageBuilder


class MSTeamsIssueNotificationsMessageBuilder(MSTeamsIssueMessageBuilder):
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

    def build_notification_card(self):
        title_block = create_text_block(
            self.notification.get_notification_title(self.context),
            size=TextSize.LARGE,
        )

        description_block = create_text_block(
            self.notification.get_message_description(self.recipient),
            size=TextSize.MEDIUM,
        )

        fields = [self.build_group_title(), description_block]

        # TODO: Add support for notification actions.
        return super().build(
            title=title_block,
            fields=fields,
            footer=self.create_footer_block(),
        )
