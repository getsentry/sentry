from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder

DISCONNECTED_MESSAGE = (
    "Slack has been uninstalled from your Sentry organization, re-install it to continue."
)


class SlackDisconnectedMessageBuilder(BlockSlackMessageBuilder):
    def get_docs_block(self) -> SlackBlock:
        return self.get_action_block(
            [
                (
                    "Sentry Docs",
                    "https://docs.sentry.io/product/alerts-notifications/alerts/",
                    "sentry_docs_link_clicked",
                )
            ]
        )

    def build(self) -> SlackBlock:
        return self._build_blocks(
            self.get_markdown_block(DISCONNECTED_MESSAGE),
            self.get_docs_block(),
        )
