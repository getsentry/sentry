from __future__ import annotations

# Discord message flags.
# See: https://discord.com/developers/docs/resources/channel#message-object-message-flags
EPHEMERAL_FLAG = 1 << 6
LOADING_FLAG = 1 << 7
SUPPRESS_NOTIFICATIONS_FLAG = 1 << 12


class DiscordMessageFlags:
    """
    Class for setting appropriate flags on a Discord message.

    See Discord docs for full list of available flags, not all are implemented
    here.

    https://discord.com/developers/docs/resources/channel#message-object-message-flags
    """

    def __init__(self):
        self.value = 0

    def set_ephemeral(self) -> DiscordMessageFlags:
        self.value = self.value | EPHEMERAL_FLAG
        return self

    def set_loading(self) -> DiscordMessageFlags:
        self.value = self.value | LOADING_FLAG
        return self

    def set_suppress_notifications(self) -> DiscordMessageFlags:
        self.value = self.value | SUPPRESS_NOTIFICATIONS_FLAG
        return self
