from django.urls import reverse

from sentry.integrations.msteams.card_builder.base import MSTeamsMessageBuilder
from sentry.integrations.msteams.card_builder.block import ActionType, AdaptiveCard, OpenUrlAction
from sentry.utils.http import absolute_uri

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


def build_mentioned_card(team_name: str) -> AdaptiveCard:
    manage_url = absolute_uri(f"{reverse('sentry-customer-domain-integrations-settings')}msteams/")
    alerts_url = absolute_uri(reverse("alerts"))
    return MSTeamsMessageBuilder().build(
        title=HelpMessages.MENTIONED_TITLE,
        text=HelpMessages.MENTIONED_TEXT.format(team_name=team_name),
        actions=[
            OpenUrlAction(
                type=ActionType.OPEN_URL, title=HelpMessages.MANAGE_BUTTON, url=manage_url
            ),
            OpenUrlAction(
                type=ActionType.OPEN_URL, title=HelpMessages.ALERT_BUTTON, url=alerts_url
            ),
        ],
    )


def build_missing_installation_card() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=HelpMessages.MISSING_INSTALLATION_TITLE,
        text=HelpMessages.MISSING_INSTALLATION_TEXT,
        actions=[
            OpenUrlAction(
                type=ActionType.OPEN_URL,
                title=HelpMessages.MISSING_INSTALLATION_BUTTON,
                url=HelpMessages.MISSING_INSTALLATION_URL,
            )
        ],
    )
