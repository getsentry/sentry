from __future__ import annotations

# to avoid a circular import
import logging

from requests import PreparedRequest

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils.json import JSONData

logger = logging.getLogger("sentry.integrations.discord")

DISCORD_BASE_URL = "https://discord.com/api/v10"

# https://discord.com/developers/docs/resources/guild#get-guild
GUILD_URL = "/guilds/{guild_id}"

# https://discord.com/developers/docs/resources/user#leave-guild
USERS_GUILD_URL = "/users/@me/guilds/{guild_id}"

# https://discord.com/developers/docs/interactions/application-commands#get-global-application-commands
APPLICATION_COMMANDS_URL = "/applications/{application_id}/commands"

# https://discord.com/developers/docs/resources/channel#get-channel
CHANNEL_URL = "/channels/{channel_id}"

# https://discord.com/developers/docs/resources/channel#create-message
MESSAGE_URL = "/channels/{channel_id}/messages"


class DiscordNonProxyClient(ApiClient):
    integration_name: str = "discord"
    base_url: str = DISCORD_BASE_URL

    def __init__(self):
        super().__init__()
        self.application_id = options.get("discord.application-id")
        self.bot_token = options.get("discord.bot-token")

    def with_base_url(self, url: str) -> str:
        return f"{DISCORD_BASE_URL}{url}"

    def overwrite_application_commands(self, commands: list[object]) -> None:
        self.put(
            APPLICATION_COMMANDS_URL.format(application_id=self.application_id),
            data=commands,
        )

    def get_guild_name(self, guild_id: str) -> str:
        url = GUILD_URL.format(guild_id=guild_id)
        headers = {"Authorization": f"Bot {self.bot_token}"}
        try:
            response = self.get(url, headers=headers)
            return response["name"]  # type: ignore
        except (ApiError, AttributeError):
            return guild_id


class DiscordClient(IntegrationProxyClient):
    integration_name: str = "discord"
    base_url: str = "https://discord.com/api/v10"

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
        super().__init__(integration_id, org_integration_id, verify_ssl, logging_context)

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        prepared_request.headers["Authorization"] = f"Bot {self.bot_token}"
        return prepared_request

    def get_guild_name(self, guild_id: str) -> str:
        """
        Normal version of get_guild_name that uses the regular auth flow.
        """
        return self.get(GUILD_URL.format(guild_id=guild_id))["name"]  # type:ignore

    def leave_guild(self, guild_id: str) -> None:
        """
        Leave the given guild_id, if the bot is currently a member.
        """
        self.delete(USERS_GUILD_URL.format(guild_id=guild_id))

    def get_channel(self, channel_id: str) -> object | None:
        """
        Get a channel by id.
        """
        return self.get(CHANNEL_URL.format(channel_id=channel_id))

    def send_message(
        self, channel_id: str, message: DiscordMessageBuilder, notification_uuid: str | None = None
    ) -> None:
        """
        Send a message to the specified channel.
        """
        self.post(
            MESSAGE_URL.format(channel_id=channel_id),
            data=message.build(notification_uuid=notification_uuid),
            timeout=5,
        )
