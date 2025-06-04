from __future__ import annotations


class DiscordMessageComponent:
    """
    Represents an abstract Discord message component.

    Child classes should override the constructor with necessary fields for
    the component type.

    https://discord.com/developers/docs/interactions/message-components#component-object
    """

    def __init__(self, type: int) -> None:
        self.type = type

    def build(self) -> dict[str, object]:
        attributes = vars(self).items()
        return {k: v for k, v in attributes if v is not None}
