from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder

EVENT_MESSAGE = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)


class SlackEventMessageBuilder(BlockSlackMessageBuilder):
    def build(self) -> SlackBody:
        return self._build_blocks(
            self.get_markdown_block(EVENT_MESSAGE),
            self.get_action_block(
                [
                    (
                        "Sentry Docs",
                        "https://docs.sentry.io/product/alerts-notifications/alerts/",
                        "sentry_docs_link_clicked",
                    )
                ]
            ),
        )
