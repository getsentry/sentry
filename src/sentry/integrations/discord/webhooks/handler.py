from rest_framework.response import Response

from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.integrations.discord.requests.base import DiscordRequest


class DiscordInteractionHandler:
    """
    Abstract class defining the shared interface of interaction handlers.
    """

    def __init__(self, request: DiscordRequest) -> None:
        """
        Request must be *verified*.
        """
        self.request: DiscordRequest = request

    def send_message(self, message: DiscordMessageBuilder) -> Response:
        """Sends a new follow up message."""
        return Response(
            {"type": 4, "data": message.build()},
            status=200,
        )

    def update_message(self, message: DiscordMessageBuilder) -> Response:
        """Replaces the message that triggered this interaction."""
        return Response(
            {"type": 7, "data": message.build()},
            status=200,
        )

    def send_error(self, text: str) -> Response:
        message = DiscordMessageBuilder(
            content=text,
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return Response(
            {"type": 4, "data": message.build()},
            status=200,
        )

    def update_error(self, text: str) -> Response:
        message = DiscordMessageBuilder(
            content=text,
            flags=DiscordMessageFlags().set_ephemeral(),
        )
        return Response(
            {"type": 7, "data": message.build()},
            status=200,
        )

    def handle(self) -> Response:
        raise NotImplementedError
