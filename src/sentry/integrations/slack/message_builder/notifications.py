from typing import Any, Mapping, Union
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    build_attachment_title,
    get_title_link,
)
from sentry.models import Team, User
from sentry.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.base import BaseNotification

from ..utils import build_notification_footer, get_referrer_qstring


def get_group_url(notification: BaseNotification) -> str:
    return str(urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification)))


class SlackNotificationsMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: Union[Team, User],
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackBody:
        if self.notification.is_message_issue_unfurl:
            return SlackIssuesMessageBuilder(
                group=self.notification.group,
                event=getattr(self.notification, "event", None),
                tags=self.context.get("tags", None),
                rules=getattr(self.notification, "rules", None),
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()

        if isinstance(self.notification, ReleaseActivityNotification):
            return self._build(
                text=self.notification.get_message_description(),
                footer=build_notification_footer(self.notification, self.recipient),
            )

        return self._build(
            title=build_attachment_title(self.notification.group),
            title_link=get_title_link(
                self.notification.group, None, False, False, self.notification
            ),
            text=self.notification.get_message_description(),
            footer=build_notification_footer(self.notification, self.recipient),
        )


def build_notification_attachment(
    notification: BaseNotification,
    context: Mapping[str, Any],
    recipient: Union[Team, User],
) -> SlackBody:
    """@deprecated"""
    return SlackNotificationsMessageBuilder(notification, context, recipient).build()
