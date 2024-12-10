from collections.abc import Iterable
from dataclasses import dataclass

from rest_framework.response import Response

from sentry.integrations.discord.requests.base import DiscordRequest
from sentry.integrations.discord.spec import DiscordMessagingSpec
from sentry.integrations.discord.utils import logger
from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.integrations.discord.webhooks.handler import DiscordInteractionHandler
from sentry.integrations.messaging import commands
from sentry.integrations.messaging.commands import (
    CommandHandler,
    CommandInput,
    CommandNotMatchedError,
    MessagingIntegrationCommand,
    MessagingIntegrationCommandDispatcher,
)
from sentry.integrations.messaging.metrics import (
    MessageCommandFailureReason,
    MessageCommandHaltReason,
)
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.types import EventLifecycleOutcome, IntegrationResponse

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
            message = dispatcher.dispatch(CommandInput("help"))

        return self.send_message(message)


@dataclass(frozen=True)
class DiscordCommandDispatcher(MessagingIntegrationCommandDispatcher[str]):
    request: DiscordRequest

    @property
    def integration_spec(self) -> MessagingIntegrationSpec:
        return DiscordMessagingSpec()

    def help_handler(self, input: CommandInput) -> IntegrationResponse[str]:
        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=HELP_MESSAGE,
        )

    def link_user_handler(self, _: CommandInput) -> IntegrationResponse[str]:
        if self.request.has_identity():
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=ALREADY_LINKED_MESSAGE.format(email=self.request.get_identity_str()),
                outcome_reason=str(MessageCommandHaltReason.ALREADY_LINKED),
                context_data={
                    "email": self.request.get_identity_str(),
                },
            )

        if not self.request.integration or not self.request.user_id:
            # TODO: remove this logger
            logger.warning(
                "discord.interaction.command.missing.integration",
                extra={
                    "hasIntegration": bool(self.request.integration),
                    "hasUserId": self.request.user_id,
                },
            )
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.FAILURE,
                response=MISSING_DATA_MESSAGE,
                outcome_reason=str(MessageCommandFailureReason.MISSING_DATA),
                context_data={
                    "has_integration": bool(self.request.integration),
                    "has_user_id": bool(self.request.user_id),
                },
            )

        link_url = build_linking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=LINK_USER_MESSAGE.format(url=link_url),
        )

    def unlink_user_handler(self, input: CommandInput) -> IntegrationResponse[str]:
        if not self.request.has_identity():
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=NOT_LINKED_MESSAGE,
                outcome_reason=str(MessageCommandHaltReason.NOT_LINKED),
            )

        # if self.request.has_identity() then these must not be None
        assert self.request.integration is not None
        assert self.request.user_id is not None

        unlink_url = build_unlinking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )

        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=UNLINK_USER_MESSAGE.format(url=unlink_url),
        )

    @property
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, CommandHandler[str]]]:

        yield commands.HELP, self.help_handler
        yield commands.LINK_IDENTITY, self.link_user_handler
        yield commands.UNLINK_IDENTITY, self.unlink_user_handler
