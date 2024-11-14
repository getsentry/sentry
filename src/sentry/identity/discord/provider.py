from typing import Any

from sentry.auth.provider import Provider


class DiscordIdentityProvider(Provider):
    key = "discord"
    name = "Discord"

    def __init__(self, **config: Any) -> None:
        super().__init__("discord", **config)
