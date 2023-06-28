from __future__ import annotations

from requests import PreparedRequest

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils.json import JSONData


class DiscordClient(IntegrationProxyClient):
    integration_name: str = "discord"
    base_url: str = "https://discord.com/api/v10"

    # https://discord.com/developers/docs/resources/guild#get-guild
    GET_GUILD_URL = "/guilds/%s"

    def __init__(
        self,
        org_integration_id: int | None = None,
        logging_context: JSONData | None = None,
    ):
        self.application_id = options.get("discord.application-id")
        self.bot_token = options.get("discord.bot-token")
        super().__init__(org_integration_id, logging_context=logging_context)

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bot {self.bot_token}"
        return prepared_request

    def _get_guild_name(self, guild_id: str) -> str:
        # Manually add authorization since this method is part of installation where we do not yet
        # have an integration created
        headers = {"Authorization": f"Bot {self.bot_token}"}
        try:
            response = self.get(DiscordClient.GET_GUILD_URL % guild_id, headers=headers)
        except ApiError:
            raise IntegrationError("Could not retrieve Discord guild name")
        return response["name"]  # type:ignore
