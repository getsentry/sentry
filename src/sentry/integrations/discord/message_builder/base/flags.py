from __future__ import annotations


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
        self.value = self.value | 1 << 6
        return self

    def set_loading(self) -> DiscordMessageFlags:
        self.value = self.value | 1 << 7
        return self

    def set_suppress_notifications(self) -> DiscordMessageFlags:
        self.value = self.value | 1 << 12
        return self
