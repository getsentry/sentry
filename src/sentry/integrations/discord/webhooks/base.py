from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.web.decorators import transaction_start


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

    @csrf_exempt
    @transaction_start("DiscordInteractionsEndpoint")
    def post(self, request: Request) -> Response:
        try:
            discord_request = self.discord_request_class(request)
            discord_request.validate()
        except DiscordRequestError as e:
            return self.respond(status=e.status)

        if discord_request.is_ping():
            # https://discord.com/developers/docs/tutorials/upgrading-to-application-commands#adding-an-interactions-endpoint-url
            return self.respond({"type": 1}, status=200)

        elif discord_request.is_command():
            # Temporary response to example command
            return self.respond(
                {
                    "type": 4,
                    "data": {
                        "content": "howdy",
                    },
                },
                status=200,
            )

        # This isn't an interaction type that we need to worry about, so we'll
        # just return 200
        return self.respond(status=200)
