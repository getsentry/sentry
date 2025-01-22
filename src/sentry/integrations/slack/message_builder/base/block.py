from __future__ import annotations

from abc import ABC
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

import orjson

from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.notifications.utils.actions import MessageAction


class BlockSlackMessageBuilder(SlackMessageBuilder, ABC):
    @staticmethod
    def get_image_block(url: str, title: str | None = None, alt: str | None = None) -> SlackBlock:
        block: dict[str, Any] = {
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
    def get_markdown_quote_block(text: str, max_block_text_length: int) -> SlackBlock:
        if len(text) > max_block_text_length:
            text = text[: max_block_text_length - 3] + "..."

        markdown_text = "```" + text + "```"

        return {"type": "section", "text": {"type": "mrkdwn", "text": markdown_text}}

    @staticmethod
    def get_tags_block(
        tags: Sequence[Mapping[str, str | bool]], block_id: dict[str, Any] | None = None
    ) -> SlackBlock:
        text = ""
        for tag in tags:
            title = tag["title"]
            value = tag["value"]
            # remove backticks from value, otherwise it will break the markdown
            value = value.replace("`", "") if isinstance(value, str) else value
            text += f"{title}: `{value}`  "

        block = {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        }

        if block_id:
            tags_block_id = block_id.copy()
            tags_block_id["block"] = "tags"
            block["block_id"] = orjson.dumps(tags_block_id).decode()

        return block

    @staticmethod
    def get_divider() -> SlackBlock:
        return {"type": "divider"}

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
    def get_button_action(action: MessageAction) -> SlackBlock:
        button_text = action.label or action.name
        button = {
            "type": "button",
            "text": {"type": "plain_text", "text": button_text},
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
        elements = []
        for text, url, value in actions:
            button = {
                "type": "button",
                "text": {"type": "plain_text", "text": text},
                "value": value,
            }
            if url:
                button["url"] = url

            elements.append(button)

        action_block = {"type": "actions", "elements": elements}
        return action_block

    @staticmethod
    def get_context_block(text: str, timestamp: datetime | None = None) -> SlackBlock:
        if timestamp:
            time = "<!date^{:.0f}^{} at {} | Sentry Issue>".format(
                timestamp.timestamp(), "{date_pretty}", "{time}"
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
    def make_field(text: str) -> dict[str, str]:
        return {
            "type": "mrkdwn",
            "text": text,
        }

    @staticmethod
    def get_section_fields_block(fields: list[dict[str, str]]) -> SlackBlock:
        return {
            "type": "section",
            "fields": fields,
        }

    @staticmethod
    def _build_blocks(
        *args: SlackBlock,
        fallback_text: str | None = None,
        color: str | None = None,
        block_id: str | None = None,
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
        return self.build()
