import logging
from collections.abc import Mapping, Sequence

from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.types import SlackBlock

_logger = logging.getLogger(__name__)

UNKNOWN_COMMAND_MESSAGE = "Unknown command: `{command}`"
HEADER_MESSAGE = "Here are the commands you can use. Commands not working? Re-install the app!"
DM_COMMAND_HEADER = "*Direct Message Commands:*"
CHANNEL_COMMANDS_HEADER = "*Channel Commands:*"
HELP_COMMANDS_HEADER = "*Help Commands:*"
HELP_COMMANDS_HEADER_MESSAGE = (
    "These commands can be run in a direct message with the Sentry app or in a channel."
)
CONTACT_HEADER = "*Contact:*"
GENERAL_MESSAGE = "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>."

DM_COMMANDS = {
    "link": "Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.",
    "unlink": "Unlink your Slack identity from your Sentry account.",
}
CHANNEL_COMMANDS = {
    "link team": "Get your Sentry team's issue alert notifications in this channel.",
    "unlink team": "Unlink a team from this channel.",
}
HELP_COMMANDS = {
    "support": "Get support resources.",
    "docs": "View documentation resources.",
    "help": "View this list of commands.",
}
CONTACT_MESSAGE = "Let us know if you have feedback: ecosystem-feedback@sentry.io"


SUPPORT_HEADER_MESSAGE = "Need support? Check out these resources:"
SUPPORT_OPTIONS_MESSAGE = "• Want help for your particular case? <https://docs.sentry.io/support|File a ticket in Zendesk>. \n• Want to report an issue, request a feature, or get support? <https://github.com/getsentry/sentry/issues/new/choose|File a GitHub issue>. \n• Have feedback? Email feedback-ecosystem@sentry.io."

DOCS_HEADER_MESSAGE = "Want to view documentation? Check out these resources:"
DOCS_OPTIONS_MESSAGE = "• <https://docs.sentry.io/organization/integrations/|General Sentry integration docs> \n• <https://docs.sentry.io/organization/integrations/notification-incidents/slack/|Sentry Slack integration docs> \n• <https://sentry.slack.com/apps/A011MFBJEUU-sentry|Sentry Slack app>"


def list_commands(commands: Mapping[str, str]) -> str:
    return "\n".join(
        (
            f"`/sentry {command}`: {description}"
            for command, description in sorted(tuple(commands.items()))
        )
    )


DM_COMMANDS_MESSAGE = list_commands(DM_COMMANDS)
CHANNEL_COMMANDS_MESSAGE = list_commands(CHANNEL_COMMANDS)
HELP_COMMANDS_MESSAGE = list_commands(HELP_COMMANDS)


class SlackHelpMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, command: str | None = None) -> None:
        super().__init__()
        self.command = command

    def get_header_blocks(self) -> Sequence[SlackBlock]:
        blocks = []
        if self.command and self.command != "help":
            _logger.info("slack.event.unknown-command", extra={"command": self.command})
            blocks.append(
                self.get_markdown_block(UNKNOWN_COMMAND_MESSAGE.format(command=self.command))
            )

        blocks.append(self.get_markdown_block(HEADER_MESSAGE))
        return blocks

    def get_help_message(self) -> SlackBlock:
        return self._build_blocks(
            *self.get_header_blocks(),
            self.get_markdown_block(DM_COMMAND_HEADER),
            self.get_markdown_block(DM_COMMANDS_MESSAGE),
            self.get_markdown_block(CHANNEL_COMMANDS_HEADER),
            self.get_markdown_block(CHANNEL_COMMANDS_MESSAGE),
            self.get_markdown_block(HELP_COMMANDS_HEADER),
            self.get_markdown_block(HELP_COMMANDS_HEADER_MESSAGE),
            self.get_markdown_block(HELP_COMMANDS_MESSAGE),
            self.get_markdown_block(CONTACT_HEADER),
            self.get_markdown_block(CONTACT_MESSAGE),
            self.get_divider(),
            self.get_markdown_block(GENERAL_MESSAGE),
        )

    def get_support_message(self) -> SlackBlock:
        return self._build_blocks(
            self.get_markdown_block(SUPPORT_HEADER_MESSAGE),
            self.get_markdown_block(SUPPORT_OPTIONS_MESSAGE),
        )

    def get_docs_message(self) -> SlackBlock:
        return self._build_blocks(
            self.get_markdown_block(DOCS_HEADER_MESSAGE),
            self.get_markdown_block(DOCS_OPTIONS_MESSAGE),
        )

    def build(self) -> SlackBlock:
        if self.command == "support":
            return self.get_support_message()
        elif self.command == "docs":
            return self.get_docs_message()
        else:
            return self.get_help_message()
