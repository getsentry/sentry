from __future__ import annotations

from typing import NotRequired, TypedDict, int


class DiscordMessageEmbedImageDict(TypedDict):
    url: str
    proxy_url: NotRequired[str]
    height: NotRequired[int]
    width: NotRequired[int]


class DiscordMessageEmbedImage:
    def __init__(
        self,
        url: str,
        proxy_url: str | None = None,
        height: int | None = None,
        width: int | None = None,
    ) -> None:
        self.url = url
        self.proxy_url = proxy_url
        self.height = height
        self.width = width

    def build(self) -> DiscordMessageEmbedImageDict:
        embed_image = DiscordMessageEmbedImageDict(url=self.url)

        if self.proxy_url is not None:
            embed_image["proxy_url"] = self.proxy_url
        if self.height is not None:
            embed_image["height"] = self.height
        if self.width is not None:
            embed_image["width"] = self.width

        return embed_image
