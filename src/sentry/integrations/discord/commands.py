from __future__ import annotations

from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions.base import ApiError
from sentry.utils.cache import cache

from .utils import logger


class DiscordCommandManager:
    # This constant defines the commands that should be available to the
    # Discord bot. Upon initialization, the DiscordCommandManager will make
    # sure the list of commands in Discord matches those in this list.
    # See Discord docs for the structure of a command https://discord.com/developers/docs/interactions/application-commands#application-command-object
    COMMANDS: list[object] = [
        {
            "name": "example",
            "description": "An example slash command!",
            "type": 1,
        },
    ]

    def register_commands(self) -> None:
        """
        Fetches the current bot commands list and if it's out of date,
        overwrites the bot commands list in Discord with the above list.
        """
        cache_key = "discord-bot-commands-updated"
        result = cache.get(cache_key)

        if result is None:
            try:
                DiscordClient().overwrite_application_commands(self.COMMANDS)
            except ApiError as e:
                logger.error("discord.setup.update_bot_commands_failure", extra={"status": e.code})

            cache.set(cache_key, True, 3600)
