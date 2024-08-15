from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import orjson

from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.types.actor import Actor


class SlackNotificationsMessageBuilder(BlockSlackMessageBuilder):
    def __init__(
        self,
        notification: BaseNotification,
        context: Mapping[str, Any],
        recipient: Actor,
    ) -> None:
        super().__init__()
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build(self) -> SlackBlock:
        callback_id_raw = self.notification.get_callback_data()
        title = self.notification.build_attachment_title(self.recipient)
        title_link = self.notification.get_title_link(self.recipient, ExternalProviders.SLACK)
        text = self.notification.get_message_description(self.recipient, ExternalProviders.SLACK)
        footer = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.SLACK
        )
        actions = self.notification.get_message_actions(self.recipient, ExternalProviders.SLACK)
        callback_id = orjson.dumps(callback_id_raw).decode() if callback_id_raw else None

        first_block_text = ""
        if title_link:
            if title:
                first_block_text += f"<{title_link}|*{escape_slack_text(title)}*>  \n"
            else:
                first_block_text += f"<{title_link}|*{escape_slack_text(title_link)}*>  \n"
        elif title:  # ie. "ZeroDivisionError",
            first_block_text += f"*{escape_slack_text(title)}*  \n"

        if text:  # ie. "division by zero", comments
            first_block_text += text

        blocks = []
        if first_block_text:
            blocks.append(self.get_markdown_block(text=first_block_text))
        if footer:
            blocks.append(self.get_context_block(text=footer))

        actions_block = []
        for action in actions:
            actions_block.append(self.get_button_action(action))

        if actions_block:
            blocks.append({"type": "actions", "elements": [action for action in actions_block]})

        return self._build_blocks(
            *blocks, fallback_text=text if text else None, callback_id=callback_id
        )
