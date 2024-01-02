from __future__ import annotations

import logging

import sentry_sdk
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.discord.webhooks.command import DiscordCommandHandler
from sentry.integrations.discord.webhooks.message_component import DiscordMessageComponentHandler
from sentry.silo import SiloMode
from sentry.web.decorators import transaction_start

from .types import DiscordResponseTypes

logger = logging.getLogger(__name__)


@all_silo_endpoint
class DiscordInteractionsEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
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

    @classmethod
    def respond_ping(cls) -> JsonResponse:
        # https://discord.com/developers/docs/tutorials/upgrading-to-application-commands#adding-an-interactions-endpoint-url
        return JsonResponse({"type": DiscordResponseTypes.PONG})

    @csrf_exempt
    @transaction_start("DiscordInteractionsEndpoint")
    def post(self, request: Request) -> HttpResponse:
        try:
            discord_request = self.discord_request_class(request)
            discord_request.validate()

            if discord_request.is_ping():
                return DiscordInteractionsEndpoint.respond_ping()

            elif discord_request.is_command():
                analytics.record(
                    "integrations.discord.command_interaction",
                    command_name=discord_request.get_command_name(),
                )
                return DiscordCommandHandler(discord_request).handle()

            elif discord_request.is_message_component():
                analytics.record(
                    "integrations.discord.message_interaction",
                    custom_id=discord_request.get_component_custom_id(),
                )
                return DiscordMessageComponentHandler(discord_request).handle()

        except DiscordRequestError as e:
            if SiloMode.get_current_mode() != SiloMode.MONOLITH:
                sentry_sdk.capture_exception(e)
            logger.exception(
                "discord.request.error",
                extra={
                    "error": str(e),
                    "status": e.status,
                },
            )
            return self.respond(status=e.status)
        except Exception as e:
            logger.exception(
                "discord.request.unexpected_error",
                extra={
                    "error": str(e),
                },
            )
            return self.respond(status=500)

        # This isn't an interaction type that we need to worry about, so we'll
        # just return 200.
        return self.respond(status=200)
