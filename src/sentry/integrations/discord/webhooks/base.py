from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.discord.views.link_identity import build_linking_url
from sentry.integrations.discord.views.unlink_identity import build_unlinking_url
from sentry.web.decorators import transaction_start

from ..utils import logger


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
        self.request: DiscordRequest

    @csrf_exempt
    @transaction_start("DiscordInteractionsEndpoint")
    def post(self, request: Request) -> Response:
        try:
            self.request = self.discord_request_class(request)
            self.request.validate()
        except DiscordRequestError as e:
            return self.respond(status=e.status)

        if self.request.is_ping():
            # https://discord.com/developers/docs/tutorials/upgrading-to-application-commands#adding-an-interactions-endpoint-url
            return self.respond({"type": 1}, status=200)

        elif self.request.is_command():
            return self.handle_command()

        # This isn't an interaction type that we need to worry about, so we'll
        # just return 200
        return self.respond(status=200)

    def reply(self, message: str) -> Response:
        return self.respond(
            {
                "type": 4,
                "data": {
                    "content": message,
                },
            },
            status=200,
        )

    def handle_command(self) -> Response:
        command_name = self.request.get_command_name()
        logging_data = self.request.logging_data

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
        if self.request.has_identity():
            return self.reply("identity already linked")

        if not (self.request.integration and self.request.user_id):
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

        link_url = build_linking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )
        return self.reply(link_url)

    def unlink_user(self) -> Response:
        if not self.request.has_identity():
            return self.reply("not linked")

        if not (self.request.integration and self.request.user_id):
            raise DiscordRequestError(status=status.HTTP_400_BAD_REQUEST)

        unlink_url = build_unlinking_url(
            integration=self.request.integration,
            discord_id=self.request.user_id,
        )
        return self.reply(unlink_url)

    def help(self) -> Response:
        return self.reply("help")
