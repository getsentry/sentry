from __future__ import annotations

from typing import Any, Mapping

from sentry.digests import Digest
from sentry.digests.utils import get_groups
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.models import Team, User
from sentry.notifications.notifications.base import BaseNotification, ProjectNotification
from sentry.notifications.notifications.digest import DigestNotification
from sentry.utils import json


def get_message_builder(klass: str) -> type[SlackNotificationsMessageBuilder]:
    """TODO(mgaeta): HACK to get around circular imports."""
    return {
        "DigestNotificationMessageBuilder": DigestNotificationMessageBuilder,
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
        callback_id_raw = self.notification.get_callback_data()
        return self._build(
            title=self.notification.build_attachment_title(self.recipient),
            title_link=self.notification.get_title_link(self.recipient),
            text=self.notification.get_message_description(self.recipient),
            footer=self.notification.build_notification_footer(self.recipient),
            actions=self.notification.get_message_actions(self.recipient),
            callback_id=json.dumps(callback_id_raw) if callback_id_raw else None,
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


class DigestNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: DigestNotification,
        context: Mapping[str, Any],
        recipient: Team | User,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification: DigestNotification = notification

    def build(self) -> SlackBody:
        """
        It's currently impossible in mypy to have recursive types so we need a
        hack to get this to return a SlackBody.
        """
        digest: Digest = self.context.get("digest", {})
        return [
            SlackIssuesMessageBuilder(  # type: ignore
                group=group,
                event=event,
                rules=[rule],
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()
            for rule, group, event in get_groups(digest)
        ]
