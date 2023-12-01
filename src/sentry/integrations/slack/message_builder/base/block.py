from __future__ import annotations

from abc import ABC
from typing import Any, Dict, List, Mapping, MutableMapping, Optional, Sequence, Tuple, TypedDict

from sentry.integrations.slack.message_builder import SlackBlock, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder


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
    def get_markdown_block(text: str) -> SlackBlock:
        return {
            "type": "section",
            "text": {"type": "mrkdwn", "text": text},
        }

    @staticmethod
    def get_tags_block(tags) -> SlackBlock:
        # TODO: rewrite build_tag_fields instead of doing this
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
        options = []
        for option in action.option_groups:
            for group in option["options"]:
                opt = {
                    "text": {
                        "type": "plain_text",
                        "text": group["text"],
                        "emoji": True,
                    }
                }
                options.append(opt)

        return {
            "type": "static_select",
            "placeholder": {"type": "plain_text", "text": action.label, "emoji": True},
            "options": options,
            "action_id": action.name,
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
    def get_context_block(text: str, timestamp: Optional[float] = None) -> SlackBlock:
        if timestamp:
            text += f" | {timestamp}"
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
        *args: SlackBlock, fallback_text: Optional[str] = None, color: Optional[str] = None
    ) -> SlackBody:
        blocks: dict[str, Any] = {"blocks": list(args)}
        print("blocks:", blocks)
        if fallback_text:
            blocks["text"] = fallback_text

        if color:
            blocks["color"] = color

        return blocks

    def as_payload(self) -> Mapping[str, Any]:
        return self.build()  # type: ignore
