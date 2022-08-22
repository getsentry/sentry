from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder

DISCONNECTED_MESSAGE = (
    "Slack has been uninstalled from your Sentry organization, re-install it to continue."
)


class SlackDisconnectedMessageBuilder(SlackHelpMessageBuilder):
    def __init__(self) -> None:
        """Override parent constructor."""
        super().__init__()

    def build(self) -> SlackBody:
        return self._build_blocks(
            self.get_markdown_block(DISCONNECTED_MESSAGE),
            self.get_docs_block(),
        )
