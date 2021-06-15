from sentry import features
from sentry.integrations.slack.message_builder import SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.models import Integration

EVENT_MESSAGE = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)
HEADER_MESSAGE = "Here are the commands you can use. Commands not working? Re-install the app!"
DM_COMMAND_HEADER = "*Direct Message Commands:*"
CHANNEL_COMMANDS_HEADER = "*Channel Commands:*"
GENERAL_MESSAGE = "Just want to learn more about Sentry? Check out our documentation."


DM_COMMANDS = {
    "link": "Link your Slack account to Sentry",
    "unlink": "Unlink your Slack account from Sentry",
    "help": "View this list of commands",
}
CHANNEL_COMMANDS = {
    "link team": "Type this into the channel in which you want your team to receive issue alert notifications"
}

DM_COMMANDS_MESSAGE = "\n".join(
    (
        f"• `/sentry {command}`: {description}"
        for command, description in sorted(tuple(DM_COMMANDS.items()))
    )
)

CHANNEL_COMMANDS_MESSAGE = "\n".join(
    (
        f"• `/sentry {command}`: {description}"
        for command, description in sorted(tuple(CHANNEL_COMMANDS.items()))
    )
)


class SlackEventMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, integration: Integration) -> None:
        super().__init__()
        self.integration = integration

    def build(self) -> SlackBody:
        action_block = self.get_action_block(
            [
                (
                    "Sentry Docs",
                    "https://docs.sentry.io/product/alerts-notifications/alerts/",
                    "sentry_docs_link_clicked",
                )
            ]
        )
        if not features.has(
            "organizations:notification-platform", self.integration.organizations.all()
        ):
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
