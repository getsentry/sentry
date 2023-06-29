from __future__ import annotations

from requests import PreparedRequest

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils.json import JSONData

from .utils import logger


class DiscordClient(IntegrationProxyClient):
    integration_name: str = "discord"
    base_url: str = "https://discord.com/api/v10"

    # https://discord.com/developers/docs/resources/guild#get-guild
    GET_GUILD_URL = "/guilds/%s"

    def __init__(
        self,
        integration_id: int | None = None,
        org_integration_id: int | None = None,
        verify_ssl: bool = True,
        logging_context: JSONData | None = None,
    ):
        self.application_id = options.get("discord.application-id")
        self.bot_token = options.get("discord.bot-token")
        self.integration_id: int | None = integration_id
        if not org_integration_id and integration_id is not None:
            org_integration_id = infer_org_integration(
                integration_id=integration_id, ctx_logger=logger
            )
        super().__init__(org_integration_id, verify_ssl, logging_context)

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bot {self.bot_token}"
        return prepared_request

    def get_guild_name(self, guild_id: str) -> str:
        """
        Normal version of get_guild_name that uses the regular auth flow.
        """
        return self.get(self.GET_GUILD_URL % guild_id)["name"]  # type:ignore

    def _get_guild_name(self, guild_id: str) -> str:
        """
        This version of get_guild_name is meant to be used during the
        integration install process where we don't yet have an integration
        created.
        """
        # We need to manually add authorization
        headers = {"Authorization": f"Bot {self.bot_token}"}
        try:
            response = self.get(self.GET_GUILD_URL % guild_id, headers=headers)
        except ApiError:
            raise IntegrationError("Could not retrieve Discord guild name")
        return response["name"]  # type:ignore
