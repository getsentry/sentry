from typing import Any

from sentry.shared_integrations.response.base import BaseApiResponse


class TextApiResponse(BaseApiResponse):
    def __init__(self, text: str, *args: Any, **kwargs: Any) -> None:
        self.text = text
        super().__init__(*args, **kwargs)

    @property
    def body(self) -> Any:
        return self.text
