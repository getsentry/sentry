from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification


def get_message_builder(klass: str) -> type[SlackNotificationsMessageBuilder]:
    """TODO(mgaeta): HACK to get around circular imports."""
    return {
        "IssueNotificationMessageBuilder": IssueNotificationMessageBuilder,
        "SlackNotificationsMessageBuilder": SlackNotificationsMessageBuilder,
    }[klass]


class SlackNotificationsMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: Team | User,
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackBody:
        return self._build(
            title=self.notification.build_attachment_title(),
            title_link=self.notification.get_title_link(),
            text=self.notification.get_message_description(),
            footer=self.notification.build_notification_footer(self.recipient),
            actions=self.notification.get_message_actions(),
        )


class IssueNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: ProjectNotification,
        context: Mapping[str, Any],
        recipient: Team | User,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification: ProjectNotification = notification

    def build(self) -> SlackBody:
        group = getattr(self.notification, "group", None)
        return SlackIssuesMessageBuilder(
            group=group,
            event=getattr(self.notification, "event", None),
            tags=self.context.get("tags", None),
            rules=getattr(self.notification, "rules", None),
            issue_details=True,
            notification=self.notification,
            recipient=self.recipient,
        ).build()
