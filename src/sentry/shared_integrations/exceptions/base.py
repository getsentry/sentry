from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from requests import Response

from sentry.utils import json


class ApiError(Exception):
    """
    Base class for errors which arise while making outgoing requests to third-party APIs.
    """

    code: int | None = None

    def __init__(
        self,
        text: str,
        code: int | None = None,
        url: str | None = None,
        host: str | None = None,
        path: str | None = None,
    ) -> None:
        if code is not None:
            self.code = code
        self.text = text
        self.url = url
        # we allow `host` and `path` to be passed in separately from `url` in case
        # either one is all we have
        self.host = host
        self.path = path
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

        if url and not self.host:
            try:
                self.host = urlparse(url).netloc
            except ValueError:
                self.host = "[invalid URL]"

        if url and not self.path:
            try:
                self.path = urlparse(url).path
            except ValueError:
                self.path = "[invalid URL]"

        super().__init__(text[:1024])

    def __str__(self) -> str:
        return self.text

    @classmethod
    def from_response(cls, response: Response, url: str | None = None) -> ApiError:
        from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized

        if response.status_code == 401:
            return ApiUnauthorized(response.text, url=url)
        elif response.status_code == 429:
            return ApiRateLimitedError(response.text, url=url)
        return cls(response.text, response.status_code, url=url)
