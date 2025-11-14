from __future__ import annotations

from typing import NotRequired, TypedDict, int


class DiscordMessageEmbedFooterDict(TypedDict):
    text: str
    icon_url: NotRequired[str]
    proxy_icon_url: NotRequired[str]


class DiscordMessageEmbedFooter:
    def __init__(
        self, text: str, icon_url: str | None = None, proxy_icon_url: str | None = None
    ) -> None:
        self.text = text
        self.icon_url = icon_url
        self.proxy_icon_url = proxy_icon_url

    def build(self) -> DiscordMessageEmbedFooterDict:
        embed_footer = DiscordMessageEmbedFooterDict(text=self.text)

        if self.icon_url is not None:
            embed_footer["icon_url"] = self.icon_url
        if self.proxy_icon_url is not None:
            embed_footer["proxy_icon_url"] = self.proxy_icon_url

        return embed_footer
