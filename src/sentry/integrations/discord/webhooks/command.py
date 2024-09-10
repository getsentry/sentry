from collections.abc import Callable, Iterable
from dataclasses import dataclass

from rest_framework.response import Response

from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.integrations.discord.utils import logger
from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler
from sentry.integrations.messaging import commands
from sentry.integrations.messaging.commands import (
    CommandInput,
    CommandNotMatchedError,
    MessagingIntegrationCommand,
    MessagingIntegrationCommandDispatcher,
)

LINK_USER_MESSAGE = "[Click here]({url}) to link your Discord account to your Sentry account."
ALREADY_LINKED_MESSAGE = "You are already linked to the Sentry account with email: `{email}`."
MISSING_DATA_MESSAGE = "You must be logged into your Sentry account for the link action to work."
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


class DiscordCommandHandler(DiscordInteractionHandler):
    """
    Handles logic for Discord Command interactions.

    Request passed in constructor must be command interaction.
    """

    def handle(self) -> Response:
        command_name = self.request.get_command_name()
        cmd_input = CommandInput(command_name)
        dispatcher = DiscordCommandDispatcher(self.request)
        try:
            message = dispatcher.dispatch(cmd_input)
        except CommandNotMatchedError:
            logger.warning(
                "discord.interaction.command.unknown",
                extra={"command": command_name, **self.request.logging_data},
            )
            message = dispatcher.help(cmd_input)

        return self.send_message(message)


@dataclass(frozen=True)
class DiscordCommandDispatcher(MessagingIntegrationCommandDispatcher[str]):
    request: DiscordRequest

    @property
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, Callable[[CommandInput], str]]]:
        yield commands.HELP, self.help
        yield commands.LINK_IDENTITY, self.link_user
        yield commands.UNLINK_IDENTITY, self.unlink_user

    def link_user(self, _: CommandInput) -> str:
        if self.request.has_identity():
            return ALREADY_LINKED_MESSAGE.format(email=self.request.get_identity_str())

        if not self.request.integration or not self.request.user_id:
            logger.warning(
                "discord.interaction.command.missing.integration",
                extra={
                    "hasIntegration": bool(self.request.integration),
                    "hasUserId": self.request.user_id,
                },
            )
            return MISSING_DATA_MESSAGE

        link_url = build_linking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return LINK_USER_MESSAGE.format(url=link_url)

    def unlink_user(self, _: CommandInput) -> str:
        if not self.request.has_identity():
            return NOT_LINKED_MESSAGE

        # if self.request.has_identity() then these must not be None
        assert self.request.integration is not None
        assert self.request.user_id is not None

        unlink_url = build_unlinking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return UNLINK_USER_MESSAGE.format(url=unlink_url)

    def help(self, _: CommandInput) -> str:
        return HELP_MESSAGE
