from __future__ import annotations


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

    def build(self) -> dict[str, str]:
        attributes = vars(self).items()
        return {k: v for k, v in attributes if v}
