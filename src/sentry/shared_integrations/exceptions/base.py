from collections import OrderedDict

from bs4 import BeautifulSoup

from sentry.utils import json


class ApiError(Exception):
    code = None
    json = None
    xml = None

    def __init__(self, text, code=None, url=None):
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
    def from_response(cls, response, url=None):
        from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized

        if response.status_code == 401:
            return ApiUnauthorized(response.text)
        elif response.status_code == 429:
            return ApiRateLimitedError(response.text)
        return cls(response.text, response.status_code, url=url)
