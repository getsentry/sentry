from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.slack.actions.message_action import SlackMessageAction
from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.notifications.notifications.base import BaseNotification
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import json

_default_logger = logging.getLogger(__name__)


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

    def _get_callback_id(self) -> str | None:
        """
        Helper method to get the callback id used for the message sent to Slack
        """
        callback_id_raw = None
        try:
            callback_id_raw = self.notification.get_callback_data()
            callback_id = (
                json.dumps_experimental("integrations.slack.enable-orjson", callback_id_raw)
                if callback_id_raw
                else None
            )
        except Exception as err:
            _default_logger.info(
                "There was an error trying to get the callback id",
                exc_info=err,
                extra={"raw_callback_id": callback_id_raw, "err_message": str(err)},
            )
            raise

        return callback_id

    def _get_first_block_text(self) -> str:
        """
        Helper method to get the first block text used for the message sent to Slack
        """
        first_block_text = ""

        title_link = self.notification.get_title_link(self.recipient, ExternalProviders.SLACK)
        title = self.notification.build_attachment_title(self.recipient)
        if title_link:
            if title:
                first_block_text += f"<{title_link}|*{escape_slack_text(title)}*>  \n"
            else:
                first_block_text += f"<{title_link}|*{escape_slack_text(title_link)}*>  \n"
        elif title:  # ie. "ZeroDivisionError",
            first_block_text += f"*{escape_slack_text(title)}*  \n"

        text = self.notification.get_message_description(self.recipient, ExternalProviders.SLACK)
        if text:  # ie. "division by zero", comments
            first_block_text += text

        return first_block_text

    def _get_actions_block(self) -> SlackBlock | None:
        """
        Helper method to get the actions block associated with the current Slack action message.
        If no actions are found, returns None.
        """
        actions_block = []
        actions = self.notification.get_message_actions(self.recipient, ExternalProviders.SLACK)
        for action in actions:
            slack_action_message = SlackMessageAction.to_slack_message_action(action)
            actions_block.append(slack_action_message.get_button())

        if not actions_block:
            return None

        return {"type": "actions", "elements": actions_block}

    def build(self) -> SlackBlock:
        """
        Method that builds the Slack block message. Leverages other helper methods to create smaller block parts
        required for the message.
        """
        # Holds the individual block elements that we want attached to our final Slack message
        blocks = []

        if first_block_text := self._get_first_block_text():
            blocks.append(self.get_markdown_block(text=first_block_text))

        footer = self.notification.build_notification_footer(
            self.recipient, ExternalProviders.SLACK
        )
        if footer:
            blocks.append(self.get_context_block(text=footer))

        if actions_block := self._get_actions_block():
            blocks.append(actions_block)

        text = self.notification.get_message_description(self.recipient, ExternalProviders.SLACK)
        return self._build_blocks(
            *blocks, fallback_text=text if text else None, callback_id=self._get_callback_id()
        )
