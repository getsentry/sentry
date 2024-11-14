from __future__ import annotations


class DiscordMessageEmbedFooter:
    def __init__(
        self, text: str, icon_url: str | None = None, proxy_icon_url: str | None = None
    ) -> None:
        self.text = text
        self.icon_url = icon_url
        self.proxy_icon_url = proxy_icon_url

    def build(self) -> dict[str, str]:
        attributes = vars(self).items()
        return {k: v for k, v in attributes if v}
