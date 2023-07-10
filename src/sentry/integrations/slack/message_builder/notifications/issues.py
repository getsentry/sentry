from __future__ import annotations

from typing import Any, Mapping

from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.notifications.notifications.base import ProjectNotification
from sentry.services.hybrid_cloud.actor import RpcActor

from .base import SlackNotificationsMessageBuilder


class IssueNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: ProjectNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
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
