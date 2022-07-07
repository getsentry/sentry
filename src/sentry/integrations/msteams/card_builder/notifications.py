from __future__ import annotations

from typing import Any, Mapping, Union

from sentry.integrations.msteams.card_builder.base.base import MSTeamsMessageBuilder, TextSize
from sentry.integrations.notifications import NotificationMessageBuilderMixin
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.integrations import ExternalProviders

from .base.base import URL_FORMAT_STR


class MSTeamsNotificationsMessageBuilder(NotificationMessageBuilderMixin, MSTeamsMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: Union[Team, User],
    ):
        super().__init__(notification, context, recipient)
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> Any:
        group = getattr(self.notification, "group", None)

        title = self.get_text_block(
            self.notification.get_notification_title(self.context), TextSize.LARGE
        )
        text = self.get_text_block(
            URL_FORMAT_STR.format(
                text=self.build_attachment_title(group),
                url=self.get_title_link(group, None, False, True, self.notification),
            )
        )

        fields = [self.get_text_block(self.notification.get_message_description(self.recipient))]

        footer = self.get_text_block(
            self.notification.build_notification_footer(
                recipient=self.recipient,
                provider=ExternalProviders.MSTEAMS,
                url_format_str=URL_FORMAT_STR,
            )
        )

        return self._build(
            title=title,
            text=text,
            fields=fields,
            footer=footer,
            # TODO: Varun fix color
            color="info",
        )
