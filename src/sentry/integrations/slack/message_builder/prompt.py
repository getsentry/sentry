from sentry.integrations.slack.message_builder import SlackBody
from sentry.utils import json

from .base.block import BlockSlackMessageBuilder

LINK_IDENTITY_MESSAGE = "Link your Slack identity to Sentry to unfurl Discover charts."


class SlackPromptLinkMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, url: str) -> None:
        super().__init__()
        self.url = url

    def build(self) -> SlackBody:
        return {
            "blocks": json.dumps(
                [
                    self.get_markdown_block(LINK_IDENTITY_MESSAGE),
                    self.get_action_block([("Link", self.url, "link"), ("Cancel", None, "ignore")]),
                ]
            )
        }
