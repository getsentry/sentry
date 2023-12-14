from __future__ import annotations

import logging
from typing import Callable

import requests
import sentry_sdk
from django.http import HttpResponse, JsonResponse
from django.http.response import HttpResponseBase
from rest_framework import status
from rest_framework.request import Request

from sentry.integrations.discord.requests.base import DiscordRequest, DiscordRequestError
from sentry.integrations.discord.views.link_identity import DiscordLinkIdentityView
from sentry.integrations.discord.views.unlink_identity import DiscordUnlinkIdentityView
from sentry.integrations.discord.webhooks.base import DiscordInteractionsEndpoint
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json
from sentry.utils.signing import unsign

logger = logging.getLogger(__name__)


class DiscordRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.DISCORD]
    webhook_identifier = WebhookProviderIdentifier.DISCORD

    control_classes = [
        DiscordLinkIdentityView,
        DiscordUnlinkIdentityView,
    ]

    # Dynamically set to avoid RawPostDataException from double reads
    _discord_request: DiscordRequest | None = None

    # https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type
    async_response_data = {"type": 5, "flags": 64}

    @property
    def discord_request(self) -> DiscordRequest | None:
        if self._discord_request is not None:
            return self._discord_request
        if self.view_class != DiscordInteractionsEndpoint:
            return None
        drf_request: Request = DiscordInteractionsEndpoint().initialize_request(self.request)
        self._discord_request: DiscordRequest = self.view_class.discord_request_class(drf_request)
        return self._discord_request

    def get_async_region_response(
        self,
        response_method: Callable[[], HttpResponseBase | None],
    ) -> JsonResponse:
        if not self.discord_request.response_url:
            return self.get_response_from_control_silo()

        def convert_to_async_response():
            region_response = response_method()
            if not region_response:
                return
            try:
                payload = json.loads(region_response.content.decode(encoding="utf-8")).get("data")
                response = requests.post(self.discord_request.response_url, json=payload)
                logger.info(
                    "%s.async_response",
                    self.provider,
                    extra={"path": self.request.path, "status_code": response.status_code},
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        # convert_to_async_response()  -> wont work synchronously because discord needs the type:5 response first
        # Thread(target=convert_to_async_response).start()

        return JsonResponse(data=self.async_response_data, status=status.HTTP_202_ACCEPTED)

    def get_integration_from_request(self) -> Integration | None:
        if self.view_class in self.control_classes:
            params = unsign(self.match.kwargs.get("signed_params"))
            integration_id = params.get("integration_id")

            return Integration.objects.filter(id=integration_id).first()

        discord_request = self.discord_request
        if self.view_class == DiscordInteractionsEndpoint and discord_request:
            if discord_request.guild_id is None:
                return None

            return Integration.objects.filter(
                provider=self.provider,
                external_id=discord_request.guild_id,
            ).first()

        with sentry_sdk.push_scope() as scope:
            scope.set_extra("path", self.request.path)
            scope.set_extra("guild_id", str(discord_request.guild_id if discord_request else None))
            sentry_sdk.capture_exception(
                Exception(
                    f"Unexpected view class in {self.provider} request parser: {self.view_class.__name__ if self.view_class else None}"
                )
            )

        logger.info(
            "%s.get_integration_from_request.no_view_class",
            self.provider,
            extra={"path": self.request.path},
        )

        return None

    def get_response(self):
        if self.view_class in self.control_classes:
            return self.get_response_from_control_silo()

        is_discord_interactions_endpoint = self.view_class == DiscordInteractionsEndpoint

        # Handle any Requests that doesn't depend on Integration/Organization prior to fetching the Regions.
        if is_discord_interactions_endpoint and self.discord_request:
            # Discord will do automated, routine security checks against the interactions endpoint, including
            # purposefully sending invalid signatures.
            try:
                self.discord_request.validate()
            except DiscordRequestError:
                return HttpResponse(status=status.HTTP_401_UNAUTHORIZED)
            if self.discord_request.is_ping():
                return DiscordInteractionsEndpoint.respond_ping()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        if is_discord_interactions_endpoint and self.discord_request:
            if self.discord_request.is_command():
                return self.get_async_region_response(
                    response_method=self.get_response_from_first_region
                )

            if self.discord_request.is_message_component():
                return self.get_async_region_response(
                    response_method=self.get_response_from_all_regions
                )

        return self.get_response_from_control_silo()
