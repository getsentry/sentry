from __future__ import annotations

from collections import OrderedDict
from typing import Any, Mapping

from bs4 import BeautifulSoup
from requests import Response

from sentry.utils import json


class ApiError(Exception):
    code: int | None = None
    json: Mapping[str, Any] | None = None
    xml: str | None = None

    def __init__(self, text: str, code: int | None = None, url: str | None = None) -> None:
        if code is not None:
            self.code = code
        self.text = text
        self.url = url
        self.xml = None
        # TODO(dcramer): pull in XML support from Jira
        if text:
            try:
                self.json = json.loads(text, object_pairs_hook=OrderedDict)
            except (json.JSONDecodeError, ValueError):
                if self.text[:5] == "<?xml":
                    # perhaps it's XML?
                    self.xml = BeautifulSoup(self.text, "xml")
                # must be an awful code.
                self.json = None
        else:
            self.json = None
        super().__init__(text[:1024])

    @classmethod
    def from_response(cls, response: Response, url: str | None = None) -> ApiError:
        from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized

        if response.status_code == 401:
            return ApiUnauthorized(response.text)
        elif response.status_code == 429:
            return ApiRateLimitedError(response.text)
        return cls(response.text, response.status_code, url=url)
