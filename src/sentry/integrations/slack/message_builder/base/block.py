from __future__ import annotations

from abc import ABC
from datetime import datetime
from typing import Any, Dict, List, Mapping, MutableMapping, Optional, Sequence, Tuple, TypedDict

from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.utils.dates import to_timestamp


class BlockSlackMessageBuilder(SlackMessageBuilder, ABC):
    @staticmethod
    def get_image_block(
        url: str, title: Optional[str] = None, alt: Optional[str] = None
    ) -> SlackBlock:
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
    def get_markdown_block(text: str, emoji: Optional[str] = None) -> SlackBlock:
        if emoji:
            text = f"{emoji} {text}"
        return {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        }

    @staticmethod
    def get_tags_block(tags) -> SlackBlock:
        fields = []
        for tag in tags:
            title = tag["title"]
            value = tag["value"]
            fields.append({"type": "mrkdwn", "text": f"*{title}:*\n{value}"})

        return {"type": "section", "fields": fields}

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

        return button

    @staticmethod
    def get_link_button(action):
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
    def get_action_block(actions: Sequence[Tuple[str, Optional[str], str]]) -> SlackBlock:
        class SlackBlockType(TypedDict):
            type: str
            elements: List[Dict[str, Any]]

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
    def get_context_block(text: str, timestamp: Optional[datetime] = None) -> SlackBlock:
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
        fallback_text: Optional[str] = None,
        color: Optional[str] = None,
        block_id: Optional[dict[str, int]] = None,
        callback_id: Optional[str] = None,
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
