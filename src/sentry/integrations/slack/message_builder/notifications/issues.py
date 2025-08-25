from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.notifications.notifications.activity.base import GroupActivityNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.types.actor import Actor

from .base import SlackNotificationsMessageBuilder


class IssueNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: GroupActivityNotification | AlertRuleNotification,
        context: Mapping[str, Any],
        recipient: Actor,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification: GroupActivityNotification | AlertRuleNotification = notification
        self.group = notification.group

    def build(self) -> SlackBlock:
        assert self.group is not None, "Group is required to build an issue notification"
        return SlackIssuesMessageBuilder(
            group=self.group,
            event=getattr(self.notification, "event", None),
            tags=self.context.get("tags", None),
            rules=getattr(self.notification, "rules", None),
            issue_details=True,
            notification=self.notification,
            recipient=self.recipient,
        ).build()
