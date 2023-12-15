from __future__ import annotations

from typing import Any, Mapping

from sentry import features
from sentry.integrations.slack.message_builder import SlackAttachment, SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class SlackNotificationsMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: RpcActor,
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackAttachment | SlackBlock:
        callback_id_raw = self.notification.get_callback_data()
        title = self.notification.build_attachment_title(self.recipient)
        title_link = self.notification.get_title_link(self.recipient, ExternalProviders.SLACK)
        text = self.notification.get_message_description(self.recipient, ExternalProviders.SLACK)
        footer = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.SLACK
        )
        actions = self.notification.get_message_actions(self.recipient, ExternalProviders.SLACK)
        callback_id = json.dumps(callback_id_raw) if callback_id_raw else None
        if not features.has("organizations:slack-block-kit", self.notification.organization):
            return self._build(
                title=title,
                title_link=title_link,
                text=text,
                footer=footer,
                actions=actions,
                callback_id=callback_id,
            )

        blocks = [
            self.get_markdown_block(text=f"<{title_link}|*{escape_slack_text(title)}*>  \n{text}"),
            self.get_context_block(text=footer),
        ]

        actions = []
        for action in actions:
            if action.label in ("Archive", "Ignore", "Mark as Ongoing", "Stop Ignoring"):
                actions.append(self.get_button_action(action))
            elif action.name == "assign":
                actions.append(self.get_static_action(action))

        if actions:
            action_block = {"type": "actions", "elements": [action for action in actions]}
            blocks.append(action_block)

        return self._build_blocks(*blocks, fallback_text=text, callback_id=callback_id)
