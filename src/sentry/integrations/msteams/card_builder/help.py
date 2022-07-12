from typing import Any

from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder

from .block import ActionType, create_action_block
from .utils import HelpMessages


class MSTeamsHelpMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(title=HelpMessages.HELP_TITLE, text=HelpMessages.HELP_MESSAGE)


class MSTeamsUnrecognizedCommandMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, command_text: str):
        self.command_text = command_text

    def build(self) -> Any:
        return self.build_card(
            title=HelpMessages.UNRECOGNIZED_COMMAND.format(command_text=self.command_text),
            text=HelpMessages.AVAILABLE_COMMANDS_TEXT,
        )


class MSTeamsMentionedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            title=HelpMessages.MENTIONED_TITLE,
            text=HelpMessages.MENTIONED_TEXT,
            actions=[
                create_action_block(
                    ActionType.OPEN_URL, title=HelpMessages.DOCS_BUTTON, url=HelpMessages.DOCS_URL
                )
            ],
        )
