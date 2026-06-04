from typing import Any

from bs4 import BeautifulSoup

from sentry.shared_integrations.response.base import BaseApiResponse


class XmlApiResponse(BaseApiResponse):
    def __init__(self, text: str, *args: Any, **kwargs: Any) -> None:
        self.xml = BeautifulSoup(text, "xml")
        super().__init__(*args, **kwargs)

    @property
    def body(self) -> Any:
        return self.xml
