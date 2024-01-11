from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import ActionType, AdaptiveCard, OpenUrlAction

from .utils import HelpMessages


def build_help_command_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=HelpMessages.HELP_TITLE, text=HelpMessages.HELP_MESSAGE
    )


def build_unrecognized_command_card(command_text: str) -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=HelpMessages.UNRECOGNIZED_COMMAND.format(command_text=command_text),
        text=HelpMessages.AVAILABLE_COMMANDS_TEXT,
    )


def build_mentioned_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=HelpMessages.MENTIONED_TITLE,
        text=HelpMessages.MENTIONED_TEXT,
        actions=[
            OpenUrlAction(
                type=ActionType.OPEN_URL, title=HelpMessages.DOCS_BUTTON, url=HelpMessages.DOCS_URL
            )
        ],
    )
