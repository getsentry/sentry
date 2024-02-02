from __future__ import annotations

from typing import Any, Mapping

from sentry import features
from sentry.digests import Digest
from sentry.digests.utils import get_groups
from sentry.integrations.slack.message_builder import SlackAttachment, SlackBlock
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

    def build(self) -> SlackAttachment | SlackBlock:
        """
        It's currently impossible in mypy to have recursive types so we need a
        hack to get this to return a SlackBody.
        """
        digest: Digest = self.context.get("digest", {})
        digest_groups = get_groups(digest)
        if not features.has("organizations:slack-block-kit", self.notification.organization):
            return [
                SlackIssuesMessageBuilder(
                    group=group,
                    event=event,
                    rules=[rule],
                    issue_details=True,
                    notification=self.notification,
                    recipient=self.recipient,
                ).build()
                for rule, group, event in digest_groups
            ]
        blocks = []
        for rule, group, event in digest_groups:
            alert_as_blocks = SlackIssuesMessageBuilder(
                group=group,
                event=event,
                rules=[rule],
                issue_details=True,
                notification=self.notification,
                recipient=self.recipient,
            ).build()
            # we iterate through the list of blocks created for each alert in the digest and add
            # each block to the list of blocks which is used for the entire digest notification
            for block in alert_as_blocks.get("blocks"):
                blocks.append(block)
        return self._build_blocks(*blocks)
