from __future__ import annotations

from abc import ABC
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.notifications.utils.actions import MessageAction
from sentry.utils.dates import to_timestamp

MAX_BLOCK_TEXT_LENGTH = 1000


class BlockSlackMessageBuilder(SlackMessageBuilder, ABC):
    @staticmethod
    def get_image_block(url: str, title: str | None = None, alt: str | None = None) -> SlackBlock:
        block: MutableMapping[str, Any] = {
            "type": "image",
            "image_url": url,
        }
        if title:
            block["title"] = {
                "type": "plain_text",
                "text": title,
                "emoji": True,
            }
        if alt:
            block["alt_text"] = alt

        return block

    @staticmethod
    def get_markdown_block(text: str, emoji: str | None = None) -> SlackBlock:
        if emoji:
            text = f"{emoji} {text}"
        return {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        }

    @staticmethod
    def get_rich_text_preformatted_block(text: str) -> SlackBlock:
        if len(text) > MAX_BLOCK_TEXT_LENGTH:
            text = text[: MAX_BLOCK_TEXT_LENGTH - 3] + "..."
        return {
            "type": "rich_text",
            "elements": [
                {
                    "type": "rich_text_preformatted",
                    "elements": [{"type": "text", "text": text}],
                    "border": 0,
                }
            ],
        }

    @staticmethod
    def get_tags_block(tags) -> SlackBlock:
        text = ""
        for tag in tags:
            title = tag["title"]
            value = tag["value"]
            text += f"{title}: `{value}`  "
        return {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        }

    @staticmethod
    def get_divider() -> SlackBlock:
        return {"type": "divider"}

    @staticmethod
    def get_static_action(action):
        return {
            "type": "static_select",
            "placeholder": {"type": "plain_text", "text": action.label, "emoji": True},
            "option_groups": [option for option in action.option_groups],
            "action_id": action.name,
        }

    @staticmethod
    def get_external_select_action(action, initial_option):
        action = {
            "type": "external_select",
            "placeholder": {"type": "plain_text", "text": action.label, "emoji": True},
            "action_id": action.name,
        }
        if initial_option:
            action["initial_option"] = initial_option

        return action

    @staticmethod
    def get_button_action(action):
        button = {
            "type": "button",
            "text": {"type": "plain_text", "text": action.label},
        }
        if action.value:
            button["action_id"] = action.value
            button["value"] = action.value

        if action.action_id:
            button["action_id"] = action.action_id

        if action.url:
            button["url"] = action.url
            button["value"] = "link_clicked"

        return button

    @staticmethod
    def get_link_button(action: MessageAction) -> SlackBlock:
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": action.label,
            },
            "accessory": {
                "type": "button",
                "text": {"type": "plain_text", "text": action.name, "emoji": True},
                "style": action.style,
                "value": action.value,
                "url": action.url,
            },
        }

    @staticmethod
    def get_action_block(actions: Sequence[tuple[str, str | None, str]]) -> SlackBlock:
        class SlackBlockType(TypedDict):
            type: str
            elements: list[dict[str, Any]]

        action_block: SlackBlockType = {"type": "actions", "elements": []}
        for text, url, value in actions:
            button = {
                "type": "button",
                "text": {"type": "plain_text", "text": text},
                "value": value,
            }
            if url:
                button["url"] = url

            action_block["elements"].append(button)

        return action_block

    @staticmethod
    def get_context_block(text: str, timestamp: datetime | None = None) -> SlackBlock:
        if timestamp:
            time = "<!date^{:.0f}^{} at {} | Sentry Issue>".format(
                to_timestamp(timestamp), "{date_pretty}", "{time}"
            )
            text += f" | {time}"

        return {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": text,
                }
            ],
        }

    @staticmethod
    def _build_blocks(
        *args: SlackBlock,
        fallback_text: str | None = None,
        color: str | None = None,
        block_id: dict[str, int] | None = None,
        callback_id: str | None = None,
        skip_fallback: bool = False,
    ) -> SlackBlock:
        blocks: dict[str, Any] = {"blocks": list(args)}

        if fallback_text and not skip_fallback:
            blocks["text"] = fallback_text

        if color:
            blocks["color"] = color

        # put the block_id into the first block
        if block_id:
            blocks["blocks"][0]["block_id"] = block_id

        if callback_id:
            blocks["callback_id"] = callback_id

        return blocks

    def as_payload(self) -> Mapping[str, Any]:
        return self.build()  # type: ignore
