from typing import Iterable, List, Optional

from sentry.features.helpers import any_organization_has_feature
from sentry.integrations.slack.message_builder import SlackBlock, SlackBody
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.models import Integration

from ..utils import logger
from .help import UNKNOWN_COMMAND_MESSAGE

EVENT_MESSAGE = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)


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
        if not any_organization_has_feature(
            "organizations:notification-platform", self.integration.organizations.all()
        ):
            return self._build_blocks(
                *self.get_header_block(),
                self.get_markdown_block(EVENT_MESSAGE),
                self.get_docs_block(),
            )

        return super().build()
