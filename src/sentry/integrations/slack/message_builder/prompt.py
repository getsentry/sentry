import orjson

from sentry.integrations.slack.message_builder.types import SlackBody

from .base.block import BlockSlackMessageBuilder

EPHEMERAL_LINK_IDENTITY_MESSAGE = "Link your Slack identity to Sentry to unfurl Discover charts."
NON_EPHEMERAL_LINK_IDENTITY_MESSAGE = "You sent an unfurlable link in <#{}>. Please link your Slack identity to Sentry to unfurl Discover charts."


class SlackPromptLinkMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, url: str, ephemeral: bool = True, channel_name: str | None = None) -> None:
        super().__init__()
        self.url = url
        # message_channel is the channel the user sent the unfurl link in
        # if passed, we will add this additional context to the message
        self.ephemeral = ephemeral
        self.channel_name = channel_name

    def build(self) -> SlackBody:
        message = (
            EPHEMERAL_LINK_IDENTITY_MESSAGE
            if self.ephemeral
            else NON_EPHEMERAL_LINK_IDENTITY_MESSAGE.format(self.channel_name)
        )

        return {
            "blocks": orjson.dumps(
                [
                    self.get_markdown_block(message),
                    self.get_action_block([("Link", self.url, "link"), ("Cancel", None, "ignore")]),
                ],
            ).decode()
        }
