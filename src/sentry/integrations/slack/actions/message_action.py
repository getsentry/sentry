from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sentry.notifications.utils.actions import BaseMessageAction


@dataclass
class SlackMessageAction(BaseMessageAction):
    """
    Class that holds information about a Slack message action.
    Has helper functions that can provide Slack specific outputs for the particular message action
    """

    label: str

    @staticmethod
    def to_slack_message_action(original: BaseMessageAction) -> SlackMessageAction:
        """
        Converts the original message into a specific SlackMessageAction object with the proper defaults
        """
        return SlackMessageAction(
            name=original.name,
            type=original.type,
            label=original.label if original.label else "",
            url=original.url,
            value=original.value,
            action_id=original.action_id,
            block_id=original.block_id,
            option_groups=original.option_groups,
            selected_options=original.selected_options,
        )

    def _get_button_text_value(self) -> str:
        """
        Returns the proper text value for the button that should be displayed to the user.
        Favors the label field if it is set, otherwise falls back to the name of the message action
        """
        return self.label or self.name

    def _get_button_text(self) -> dict[str, str]:
        """
        Returns the proper structure for the button text that Slack expects to display
        """
        return {"type": "plain_text", "text": self._get_button_text_value()}

    def get_button(self) -> Mapping[str, Any]:
        """
        Create a block kit supported button for this action to be used in a Slack message
        """
        button = {
            "type": "button",
            "text": self._get_button_text(),
        }
        if self.value:
            button["action_id"] = self.value
            button["value"] = self.value

        if self.action_id:
            button["action_id"] = self.action_id

        if self.url:
            button["url"] = self.url
            button["value"] = "link_clicked"

        return button
