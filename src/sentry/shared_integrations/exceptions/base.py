from __future__ import annotations

from typing import Any

from bs4 import BeautifulSoup
from requests import Response

from sentry.utils import json


class ApiError(Exception):
    code: int | None = None

    def __init__(self, text: str, code: int | None = None, url: str | None = None) -> None:
        if code is not None:
            self.code = code
        self.text = text
        self.url = url
        self.json: dict[str, Any] | None = None
        self.xml: BeautifulSoup | None = None
        # TODO(dcramer): pull in XML support from Jira
        if text:
            try:
                self.json = json.loads(text)
            except (json.JSONDecodeError, ValueError):
                if self.text[:5] == "<?xml":
                    # perhaps it's XML?
                    self.xml = BeautifulSoup(self.text, "xml")
        super().__init__(text[:1024])

    @classmethod
    def from_response(cls, response: Response, url: str | None = None) -> ApiError:
        from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized

        if response.status_code == 401:
            return ApiUnauthorized(response.text)
        elif response.status_code == 429:
            return ApiRateLimitedError(response.text)
        return cls(response.text, response.status_code, url=url)
