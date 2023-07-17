from __future__ import annotations

from sentry.integrations.discord.client import DiscordClient
from sentry.shared_integrations.exceptions.base import ApiError


class DiscordCommandManager:
    # This constant defines the commands that should be available to the
    # Discord bot. Upon initialization, the DiscordCommandManager will make
    # sure the list of commands in Discord matches those in this list.
    # See Discord docs for the structure of a command https://discord.com/developers/docs/interactions/application-commands#application-command-object
    commands: list[object] = [
        {
            "name": "example",
            "description": "An example slash command!",
            "type": 1,
        },
    ]

    def register_commands(self) -> None:
        """
        Updates commands in Discord such that the remote list of
        commands matches self.commands.
        """
        # for some reason this is called many times during initialization,
        # leading to us hitting a rate limit. So we'll just allow that
        # API error to not break everything.
        try:
            DiscordClient().overwrite_application_commands(self.commands)
        except ApiError:
            pass
