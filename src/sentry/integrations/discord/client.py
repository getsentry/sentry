from __future__ import annotations

from sentry.integrations.client import ApiClient


class DiscordClient(ApiClient):
    integration_name: str = "discord"
    base_url: str = "https://discord.com/api/v10"

    # https://discord.com/developers/docs/resources/guild#get-guild
    GET_GUILD_URL = "/guilds/%s"

    def __init__(self, application_id: str, bot_token: str):
        super().__init__()
        self.application_id = application_id
        self.bot_token = bot_token

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": f"Bot {self.bot_token}"}
        return self._request(method, path, headers=headers, data=data, params=params)

    def get_guild_name(self, guild_id: str) -> str:
        return str(self.get(self.GET_GUILD_URL % guild_id).get("name"))
