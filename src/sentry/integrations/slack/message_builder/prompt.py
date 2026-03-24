import orjson

from sentry.integrations.slack.message_builder.types import SlackBody

from .base.block import BlockSlackMessageBuilder

LINK_IDENTITY_MESSAGE = "Link your Slack identity to Sentry to unfurl Discover charts."


class SlackPromptLinkMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, url: str, message: str = LINK_IDENTITY_MESSAGE) -> None:
        super().__init__()
        self.url = url
        self.message = message

    def build(self) -> SlackBody:
        return {
            "blocks": orjson.dumps(
                [
                    self.get_markdown_block(self.message),
                    self.get_action_block([("Link", self.url, "link"), ("Cancel", None, "ignore")]),
                ],
            ).decode()
        }
