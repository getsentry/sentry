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
    GUILD_URL = "/guilds/{guild_id}"

    # https://discord.com/developers/docs/resources/user#leave-guild
    USERS_GUILD_URL = "/users/@me/guilds/{guild_id}"

    # https://discord.com/developers/docs/interactions/application-commands#get-global-application-commands
    APPLICATION_COMMANDS = "/applications/{application_id}/commands"

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
        return self.get(self.GUILD_URL.format(guild_id=guild_id))["name"]  # type:ignore

    def leave_guild(self, guild_id: str) -> None:
        """
        Leave the given guild_id, if the bot is currently a member.
        """
        self.delete(self.USERS_GUILD_URL.format(guild_id=guild_id))

    def overwrite_application_commands(self, commands: list[object]) -> None:
        self.put(
            self.APPLICATION_COMMANDS.format(application_id=self.application_id),
            data=commands,
        )
