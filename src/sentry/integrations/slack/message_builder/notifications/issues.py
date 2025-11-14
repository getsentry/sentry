from __future__ import annotations

from collections.abc import Mapping
from typing import int, Any

from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.notifications.notifications.base import ProjectNotification
from sentry.types.actor import Actor

from .base import SlackNotificationsMessageBuilder


class IssueNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: ProjectNotification,
        context: Mapping[str, Any],
        recipient: Actor,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification: ProjectNotification = notification

    def build(self) -> SlackBlock:
        return SlackIssuesMessageBuilder(
            group=self.notification.group,
            event=getattr(self.notification, "event", None),
            tags=self.context.get("tags", None),
            rules=getattr(self.notification, "rules", None),
            issue_details=True,
            notification=self.notification,
            recipient=self.recipient,
        ).build()
