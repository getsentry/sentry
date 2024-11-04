from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.digests.notifications import Digest
from sentry.digests.utils import get_groups
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.notifications.notifications.digest import DigestNotification
from sentry.types.actor import Actor

from .base import SlackNotificationsMessageBuilder


class DigestNotificationMessageBuilder(SlackNotificationsMessageBuilder):
    def __init__(
        self,
        notification: DigestNotification,
        context: Mapping[str, Any],
        recipient: Actor,
    ) -> None:
        super().__init__(notification, context, recipient)
        self.notification: DigestNotification = notification

    def build(self) -> SlackBlock:
        """
        It's currently impossible in mypy to have recursive types so we need a
        hack to get this to return a SlackBody.
        """
        digest: Digest = self.context.get("digest", {})
        digest_groups = get_groups(digest)
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
            for block in alert_as_blocks["blocks"]:
                blocks.append(block)
        return self._build_blocks(*blocks)
