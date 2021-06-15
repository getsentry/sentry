from abc import ABC
from typing import Any, MutableMapping, Optional, Sequence, Tuple

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
    def get_divider() -> SlackBlock:
        return {"type": "divider"}

    @staticmethod
    def get_action_block(actions: Sequence[Tuple[str, str, str]]) -> SlackBlock:
        return {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": text},
                    "url": url,
                    "value": value,
                }
                for text, url, value in actions
            ],
        }

    @staticmethod
    def _build_blocks(*args: SlackBlock) -> SlackBody:
        return {"blocks": args}
