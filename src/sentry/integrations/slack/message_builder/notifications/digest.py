from __future__ import annotations

from typing import Any, Mapping

from sentry.digests import Digest
from sentry.digests.utils import get_groups
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.notifications.notifications.digest import DigestNotification
from sentry.services.hybrid_cloud.actor import RpcActor

from .base import SlackNotificationsMessageBuilder


class DigestNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: DigestNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
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
            SlackIssuesMessageBuilder(
                group=group,
                event=event,
                rules=[rule],
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()
            for rule, group, event in get_groups(digest)
        ]
