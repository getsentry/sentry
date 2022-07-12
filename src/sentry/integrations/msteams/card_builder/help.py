from typing import Any

from sentry.integrations.msteams.card_builder.base import ActionType, MSTeamsMessageBuilder

HELP_TITLE = "Please use one of the following commands for Sentry:"
HELP_MESSAGE = (
    "- **link**: link your Microsoft Teams identity to your Sentry account"
    "\n\n- **unlink**: unlink your Microsoft Teams identity from your Sentry account"
    "\n\n- **help**: view list of all bot commands"
)

UNRECOGNIZED_COMMAND = "Sorry, I didn't understand '{command_text}'."
AVAILABLE_COMMANDS_TEXT = "Type **help**: to see the list of available commands"

MENTIONED_TITLE = (
    "Sentry for Microsoft Teams does not support any commands in channels, only in direct messages."
    " To unlink your Microsoft Teams identity from your Sentry account message the personal bot."
)
MENTIONED_TEXT = (
    "Want to learn more about configuring alerts in Sentry? Check out our documentation."
)
DOCS_BUTTON = "Docs"
DOCS_URL = "https://docs.sentry.io/product/alerts-notifications/alerts/"


class MSTeamsHelpMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(title=HELP_TITLE, text=HELP_MESSAGE)


class MSTeamsUnrecognizedCommandMessageBuilder(MSTeamsMessageBuilder):
    def __init__(self, command_text: str):
        self.command_text = command_text

    def build(self) -> Any:
        return self.build_card(
            title=UNRECOGNIZED_COMMAND.format(command_text=self.command_text),
            text=AVAILABLE_COMMANDS_TEXT,
        )


class MSTeamsMentionedMessageBuilder(MSTeamsMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            title=MENTIONED_TITLE,
            text=MENTIONED_TEXT,
            actions=[self.get_action_block(ActionType.OPEN_URL, title=DOCS_BUTTON, url=DOCS_URL)],
        )
