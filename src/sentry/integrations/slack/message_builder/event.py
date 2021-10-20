from typing import Iterable, List, Optional

from sentry.integrations.slack.message_builder import SlackBlock, SlackBody
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.models import Integration

from ..utils import logger
from .help import UNKNOWN_COMMAND_MESSAGE


class SlackEventMessageBuilder(SlackHelpMessageBuilder):
    def __init__(self, integration: Integration, command: Optional[str] = None) -> None:
        super().__init__()
        self.integration = integration
        self.command = command

    def get_header_block(self) -> Iterable[SlackBlock]:
        blocks: List[SlackBlock] = []
        if self.command != "help":
            logger.info("slack.event.unknown-command", extra={"command": self.command})
            blocks.append(
                self.get_markdown_block(UNKNOWN_COMMAND_MESSAGE.format(command=self.command))
            )
        return blocks

    def build(self) -> SlackBody:
        return super().build()
