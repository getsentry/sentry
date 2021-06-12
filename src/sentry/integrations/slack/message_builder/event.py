from sentry import features
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder

HEADER_MESSAGE = (
    "Here's a bunch of information about this app! Commands not working? Re-install the app!"
)
DM_COMMAND_HEADER = "*Direct Message Commands:*"
DM_COMMANDS_MESSAGE = "• `/sentry link`: Link your Slack account to Sentry \n • `/sentry unlink`: Unlink your Slack account from Sentry\n • `/sentry help`, `help`: See this information again"
CHANNEL_COMMANDS_HEADER = "*Channel Commands:*"
CHANNEL_COMMANDS_MESSAGE = "• `/sentry link team`: Type this into the channel in which you want your team to receive issue alert notifications in"
GENERAL_MESSAGE = "Just want to learn more about Sentry? Check out our documentation."

EVENT_MESSAGE = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)


class SlackEventMessageBuilder(BlockSlackMessageBuilder):
    def build(self, integration) -> SlackBody:
        action_block = self.get_action_block(
            [
                (
                    "Sentry Docs",
                    "https://docs.sentry.io/product/alerts-notifications/alerts/",
                    "sentry_docs_link_clicked",
                )
            ]
        )
        if not features.has("organizations:notification-platform", integration.organizations.all()):
            return self._build_blocks(
                self.get_markdown_block(EVENT_MESSAGE),
                action_block,
            )
        return self._build_blocks(
            self.get_markdown_block(HEADER_MESSAGE),
            self.get_markdown_block(DM_COMMAND_HEADER),
            self.get_markdown_block(DM_COMMANDS_MESSAGE),
            self.get_markdown_block(CHANNEL_COMMANDS_HEADER),
            self.get_markdown_block(CHANNEL_COMMANDS_MESSAGE),
            self.get_divider(),
            self.get_markdown_block(GENERAL_MESSAGE),
            action_block,
        )
