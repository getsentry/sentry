from typing import Sequence

from sentry.integrations.slack.message_builder import SlackBlock
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder

from ..utils import logger
from .help import UNKNOWN_COMMAND_MESSAGE


class SlackEventMessageBuilder(SlackHelpMessageBuilder):
    def get_header_blocks(self) -> Sequence[SlackBlock]:
        blocks = []
        if self.command and self.command != "help":
            logger.info("slack.event.unknown-command", extra={"command": self.command})
            blocks.append(
                self.get_markdown_block(UNKNOWN_COMMAND_MESSAGE.format(command=self.command))
            )

        return blocks
