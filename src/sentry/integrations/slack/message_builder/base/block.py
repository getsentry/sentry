from abc import ABC
from typing import TYPE_CHECKING, Any, Dict, List, MutableMapping, Optional, Sequence, Tuple

from sentry.integrations.slack.message_builder import SlackBlock, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass


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
    def get_action_block(actions: Sequence[Tuple[str, Optional[str], str]]) -> SlackBlock:
        SlackBlockType = TypedDict(
            "SlackBlockType", {"type": str, "elements": List[Dict[str, Any]]}
        )
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
    def _build_blocks(*args: SlackBlock) -> SlackBody:
        return {"blocks": args}
