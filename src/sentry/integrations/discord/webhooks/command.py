from rest_framework import status
from rest_framework.response import Response

from sentry.integrations.discord.requests.base import DiscordRequestError
from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler

from ..utils import logger

LINK_USER_MESSAGE = "[Click here]({url}) to link your Discord account to your Sentry account."
ALREADY_LINKED_MESSAGE = "You are already linked to the Sentry account with email: `{email}`."
UNLINK_USER_MESSAGE = "[Click here]({url}) to unlink your Discord account from your Sentry Account."
NOT_LINKED_MESSAGE = (
    "Your Discord account is not linked to a Sentry account. Use `/link` to link your accounts."
)
HELP_MESSAGE = """
`/help`: View this message.
`/link`: Link your Discord account to your Sentry account to perform actions on Sentry notifications.
`/unlink`: Unlink your Discord account from your Sentry account.

Note that in order for the link and unlink actions to work, you must be already logged in to your Sentry account.
"""


class DiscordCommandNames:
    LINK = "link"
    UNLINK = "unlink"
    HELP = "help"


class DiscordCommandHandler(DiscordInteractionHandler):
    """
    Handles logic for Discord Command interactions.

    Request passed in constructor must be command interaction.
    """

    def handle(self) -> Response:
        command_name = self.request.get_command_name()
        logging_data = self.request.logging_data

        if command_name == DiscordCommandNames.LINK:
            return self.link_user()
        elif command_name == DiscordCommandNames.UNLINK:
            return self.unlink_user()
        elif command_name == DiscordCommandNames.HELP:
            return self.help()

        logger.warning(
            "discord.interaction.command.unknown", extra={"command": command_name, **logging_data}
        )
        return self.help()

    def link_user(self) -> Response:
        if self.request.has_identity():
            return self.send_message(
                ALREADY_LINKED_MESSAGE.format(email=self.request.get_identity_str())
            )

        if not self.request.integration or not self.request.user_id:
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

        link_url = build_linking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return self.send_message(LINK_USER_MESSAGE.format(url=link_url))

    def unlink_user(self) -> Response:
        if not self.request.has_identity():
            return self.send_message(NOT_LINKED_MESSAGE)

        # if self.request.has_identity() then these must not be None
        assert self.request.integration is not None
        assert self.request.user_id is not None

        unlink_url = build_unlinking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return self.send_message(UNLINK_USER_MESSAGE.format(url=unlink_url))

    def help(self) -> Response:
        return self.send_message(HELP_MESSAGE)
