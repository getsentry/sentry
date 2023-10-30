from __future__ import annotations

from rest_framework.response import Response

from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.flags import DiscordMessageFlags
from sentry.integrations.discord.requests.base import DiscordRequest

from .types import DiscordResponseTypes


class DiscordInteractionHandler:
    """
    Abstract class defining the shared interface of interaction handlers,
    along with some helper methods.
    """

    def __init__(self, request: DiscordRequest) -> None:
        """
        Request must be *verified*.
        """
        self.request: DiscordRequest = request

    def send_message(self, message: str | DiscordMessageBuilder, update: bool = False) -> Response:
        """Sends a new follow up message."""
        response_type = DiscordResponseTypes.UPDATE if update else DiscordResponseTypes.MESSAGE

        if isinstance(message, str):
            message = DiscordMessageBuilder(
                content=message, flags=DiscordMessageFlags().set_ephemeral()
            )
        return Response(
            {
                "type": response_type,
                "data": message.build(),
            },
            status=200,
        )

    def handle(self) -> Response:
        raise NotImplementedError
