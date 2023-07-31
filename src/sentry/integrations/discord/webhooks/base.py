from __future__ import annotations

from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.discord.message_builder.base import (
    DiscordMessageBuilder,
    DiscordMessageFlags,
)
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.select_menu import DiscordSelectMenu
from sentry.integrations.discord.message_builder.issues import get_assign_selector_options
from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.models.group import Group
from sentry.web.decorators import transaction_start

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
"""


@region_silo_endpoint
class DiscordInteractionsEndpoint(Endpoint):
    """
    All Discord -> Sentry communication will come through our interactions
    endpoint. We need to figure out what Discord is sending us and direct the
    request to the appropriate handler.
    """

    authentication_classes = ()
    permission_classes = ()
    discord_request_class = DiscordRequest
    provider = "discord"

    def __init__(self) -> None:
        super().__init__()
        self.discord_request: DiscordRequest

    @csrf_exempt
    @transaction_start("DiscordInteractionsEndpoint")
    def post(self, request: Request) -> Response:
        try:
            self.discord_request = self.discord_request_class(request)
            self.discord_request.validate()

            if self.discord_request.is_ping():
                # https://discord.com/developers/docs/tutorials/upgrading-to-application-commands#adding-an-interactions-endpoint-url
                return self.respond({"type": 1}, status=200)

            elif self.discord_request.is_command():
                return self.handle_command()

            elif self.discord_request.is_message_component():
                return self.handle_message_component()

        except DiscordRequestError as e:
            return self.respond(status=e.status)

        # This isn't an interaction type that we need to worry about, so we'll
        # just return 200
        return self.respond(status=200)

    def send_message(self, message: DiscordMessageBuilder) -> Response:
        return self.respond(
            {"type": 4, "data": message.build()},
            headers={"Content-Type": "application/json"},
            status=200,
        )

    def handle_command(self) -> Response:
        command_name = self.discord_request.get_command_name()
        logging_data = self.discord_request.logging_data

        if command_name == "link":
            logger.info("discord.interaction.command.link", extra={**logging_data})
            return self.link_user()
        elif command_name == "unlink":
            logger.info("discord.interaction.command.unlink", extra={**logging_data})
            return self.unlink_user()
        elif command_name == "help":
            logger.info("discord.interaction.command.help", extra={**logging_data})
            return self.help()

        logger.info(
            "discord.interaction.command.unknown", extra={"command": command_name, **logging_data}
        )
        return self.help()

    def link_user(self) -> Response:
        if self.discord_request.has_identity():
            message = DiscordMessageBuilder(
                content=ALREADY_LINKED_MESSAGE.format(
                    email=self.discord_request.get_identity_str()
                ),
                flags=DiscordMessageFlags().set_ephemeral(),
            )
            return self.send_message(message)

        if not self.discord_request.integration or not self.discord_request.user_id:
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

        link_url = build_linking_url(
            integration=self.discord_request.integration,
            discord_id=self.discord_request.user_id,
        )

        message = DiscordMessageBuilder(
            content=LINK_USER_MESSAGE.format(url=link_url),
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message)

    def unlink_user(self) -> Response:
        if not self.discord_request.has_identity():
            message = DiscordMessageBuilder(
                content=NOT_LINKED_MESSAGE, flags=DiscordMessageFlags().set_ephemeral()
            )
            return self.send_message(message)

        # if self.discord_request.has_identity() then these must not be None
        assert self.discord_request.integration is not None
        assert self.discord_request.user_id is not None

        unlink_url = build_unlinking_url(
            integration=self.discord_request.integration,
            discord_id=self.discord_request.user_id,
        )

        message = DiscordMessageBuilder(
            content=UNLINK_USER_MESSAGE.format(url=unlink_url),
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return self.send_message(message)

    def help(self) -> Response:
        message = DiscordMessageBuilder(
            content=HELP_MESSAGE, flags=DiscordMessageFlags().set_ephemeral()
        )
        return self.send_message(message)

    def handle_message_component(self) -> Response:
        custom_id = self.discord_request.get_component_custom_id()

        if custom_id.startswith("assign:"):
            # everything after the ':' is the group id
            group_id = custom_id.split(":")[1]
            group = Group.objects.get(id=group_id)

            assign_selector = DiscordSelectMenu(
                custom_id="assign_to",
                placeholder="Select Assignee...",
                options=get_assign_selector_options(group),
            )
            message = DiscordMessageBuilder(
                components=[DiscordActionRow([assign_selector])],
                flags=DiscordMessageFlags().set_ephemeral(),
            )
            return self.send_message(message)

        return self.help()
