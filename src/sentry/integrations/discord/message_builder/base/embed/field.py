from __future__ import annotations


class DiscordMessageEmbedField:
    def __init__(self, name: str, value: str, inline: bool = False) -> None:
        self.name = name
        self.value = value
        self.inline = inline

    def build(self) -> dict[str, str]:
        attributes = vars(self).items()
        return {k: v for k, v in attributes if v is not None}
