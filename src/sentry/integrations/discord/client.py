from __future__ import annotations

# to avoid a circular import
import logging

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder

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


class DiscordClient(ApiClient):
    integration_name: str = "discord"
    base_url: str = DISCORD_BASE_URL

    def __init__(self):
        super().__init__()
        self.application_id = options.get("discord.application-id")
        self.bot_token = options.get("discord.bot-token")

    def prepare_auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bot {self.bot_token}"}

    def set_application_command(self, command: object) -> None:
        self.post(
            APPLICATION_COMMANDS_URL.format(application_id=self.application_id),
            headers=self.prepare_auth_header(),
            data=command,
        )

    def has_application_commands(self) -> bool:
        response = self.get(
            APPLICATION_COMMANDS_URL.format(application_id=self.application_id),
            headers=self.prepare_auth_header(),
        )
        return bool(response)

    def get_guild_name(self, guild_id: str) -> str:
        response = self.get(GUILD_URL.format(guild_id=guild_id), headers=self.prepare_auth_header())
        return response["name"]  # type: ignore

    def leave_guild(self, guild_id: str) -> None:
        """
        Leave the given guild_id, if the bot is currently a member.
        """
        self.delete(USERS_GUILD_URL.format(guild_id=guild_id), headers=self.prepare_auth_header())

    def get_channel(self, channel_id: str) -> object | None:
        """
        Get a channel by id.
        """
        return self.get(
            CHANNEL_URL.format(channel_id=channel_id), headers=self.prepare_auth_header()
        )

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
            headers=self.prepare_auth_header(),
        )
