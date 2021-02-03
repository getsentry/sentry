from bs4 import BeautifulSoup
from collections import OrderedDict
from requests.exceptions import RequestException

from simplejson.decoder import JSONDecodeError
from six.moves.urllib.parse import urlparse
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
            except (JSONDecodeError, ValueError):
                if self.text[:5] == "<?xml":
                    # perhaps it's XML?
                    self.xml = BeautifulSoup(self.text, "xml")
                # must be an awful code.
                self.json = None
        else:
            self.json = None
        super(ApiError, self).__init__(text[:1024])

    @classmethod
    def from_response(cls, response, url=None):
        if response.status_code == 401:
            return ApiUnauthorized(response.text)
        return cls(response.text, response.status_code, url=url)


class ApiHostError(ApiError):
    code = 503

    @classmethod
    def from_exception(cls, exception):
        if getattr(exception, "request"):
            return cls.from_request(exception.request)
        return cls("Unable to reach host")

    @classmethod
    def from_request(cls, request):
        host = urlparse(request.url).netloc
        return cls("Unable to reach host: {}".format(host))


class ApiTimeoutError(ApiError):
    code = 504

    @classmethod
    def from_exception(cls, exception):
        if getattr(exception, "request"):
            return cls.from_request(exception.request)
        return cls("Timed out reaching host")

    @classmethod
    def from_request(cls, request):
        host = urlparse(request.url).netloc
        return cls("Timed out attempting to reach host: {}".format(host))


class ApiUnauthorized(ApiError):
    code = 401


class UnsupportedResponseType(ApiError):
    @property
    def content_type(self):
        return self.text


class IntegrationError(Exception):
    pass


class DuplicateDisplayNameError(IntegrationError):
    pass


class IntegrationFormError(IntegrationError):
    def __init__(self, field_errors):
        super(IntegrationFormError, self).__init__("Invalid integration action")
        self.field_errors = field_errors


class IgnorableSentryAppError(RequestException):
    pass


class ClientError(RequestException):
    """4xx Error Occurred"""

    def __init__(self, status_code, url, response=None):
        http_error_msg = "%s Client Error: for url: %s" % (status_code, url)
        super(ClientError, self).__init__(http_error_msg, response=response)
