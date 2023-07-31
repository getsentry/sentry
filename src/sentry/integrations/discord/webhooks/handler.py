from rest_framework.response import Response

from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.requests.base import DiscordRequest


class DiscordInteractionHandler:
    """
    Abstract class defining the shared interface of interaction handlers.
    """

    def __init__(self, request: DiscordRequest) -> None:
        """
        Request must be *verified*.
        """
        self.request = request

    def send_message(self, message: DiscordMessageBuilder) -> Response:
        return Response(
            {"type": 4, "data": message.build()},
            headers={"Content-Type": "application/json"},
            status=200,
        )

    def handle(self) -> Response:
        raise NotImplementedError
