from typing import Iterable, List, Mapping, Optional

from sentry.integrations.slack.message_builder import SlackBlock, SlackBody
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder

from ..utils import logger

UNKNOWN_COMMAND_MESSAGE = "Unknown command: `{command}`"
HEADER_MESSAGE = "Here are the commands you can use. Commands not working? Re-install the app!"
DM_COMMAND_HEADER = "*Direct Message Commands:*"
CHANNEL_COMMANDS_HEADER = "*Channel Commands:*"
CONTACT_HEADER = "*Contact:*"
GENERAL_MESSAGE = "Just want to learn more about Sentry? Check out our <https://docs.sentry.io/product/integrations/notification-incidents/slack/|documentation>."

DM_COMMANDS = {
    "link": "Link your Slack identity to your Sentry account to receive notifications. You'll also be able to perform actions in Sentry through Slack.",
    "unlink": "Unlink your Slack identity from your Sentry account.",
    "help": "View this list of commands.",
}
CHANNEL_COMMANDS = {
    "link team": "Get your Sentry team's issue alert notifications in the channel this command is typed in.",
    "unlink team": "Unlink a team from the channel this command is typed in.",
}
CONTACT_MESSAGE = "Let us know if you have feedback: ecosystem-feedback@sentry.io"


def list_commands(commands: Mapping[str, str]) -> str:
    return "\n".join(
        (
            f"`/sentry {command}`: {description}"
            for command, description in sorted(tuple(commands.items()))
        )
    )


DM_COMMANDS_MESSAGE = list_commands(DM_COMMANDS)
CHANNEL_COMMANDS_MESSAGE = list_commands(CHANNEL_COMMANDS)


class SlackHelpMessageBuilder(BlockSlackMessageBuilder):
    def __init__(self, command: Optional[str] = None) -> None:
        super().__init__()
        self.command = command

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

    def get_header_blocks(self) -> Iterable[SlackBlock]:
        blocks: List[SlackBlock] = []
        if self.command and self.command != "help":
            logger.info("slack.event.unknown-command", extra={"command": self.command})
            blocks.append(
                self.get_markdown_block(UNKNOWN_COMMAND_MESSAGE.format(command=self.command))
            )

        blocks.append(self.get_markdown_block(HEADER_MESSAGE))
        return blocks

    def build(self) -> SlackBody:
        return self._build_blocks(
            *self.get_header_blocks(),
            self.get_markdown_block(DM_COMMAND_HEADER),
            self.get_markdown_block(DM_COMMANDS_MESSAGE),
            self.get_markdown_block(CHANNEL_COMMANDS_HEADER),
            self.get_markdown_block(CHANNEL_COMMANDS_MESSAGE),
            self.get_markdown_block(CONTACT_HEADER),
            self.get_markdown_block(CONTACT_MESSAGE),
            self.get_divider(),
            self.get_markdown_block(GENERAL_MESSAGE),
        )
