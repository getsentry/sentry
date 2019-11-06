from __future__ import absolute_import

from base64 import b64encode
from six.moves.urllib.parse import urlencode


def get_basic_auth(username, password):
    basic_auth = b64encode(username + ":" + password).decode("ascii")

    return "Basic %s" % basic_auth


def remove_trailing_slashes(url):
    return url.strip().rstrip("/")


def add_query_params(url, query_params):
    query_string = urlencode(query_params)
    return url + "?" + query_string
