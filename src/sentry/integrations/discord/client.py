from __future__ import annotations

from requests import PreparedRequest

from sentry import options
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.utils.json import JSONData

from .utils import logger


class DiscordClient(IntegrationProxyClient):
    integration_name: str = "discord"
    base_url: str = "https://discord.com/api/v10"

    # https://discord.com/developers/docs/resources/guild#get-guild
    guild_url = "/guilds/{guild_id}"

    # https://discord.com/developers/docs/resources/user#leave-guild
    users_guild_url = "/users/@me/guilds/{guild_id}"

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
        return self.get(self.guild_url.format(guild_id=guild_id))["name"]  # type:ignore

    def leave_guild(self, guild_id: str) -> None:
        """
        Leave the given guild_id, if the bot is currently a member.
        """
        return self.delete(self.users_guild_url.format(guild_id=guild_id))
