import logging
import random
import re
import time
from urllib.parse import parse_qsl

from django.conf import settings
from django.core.cache import cache

from sentry import http
from sentry.utils import json
from sentry.utils.safe import get_path
from sentry.utils.strings import count_sprintf_parameters

logger = logging.getLogger(__name__)

SOFT_TIMEOUT = 600
SOFT_TIMEOUT_FUZZINESS = 10
HARD_TIMEOUT = 7200

REACT_MAPPING_URL = (
    "https://raw.githubusercontent.com/facebook/" "react/master/scripts/error-codes/codes.json"
)

error_processors = {}


def is_expired(ts):
    return ts > (time.time() - SOFT_TIMEOUT - random.random() * SOFT_TIMEOUT_FUZZINESS)


class Processor:
    def __init__(self, vendor, mapping_url, regex, func):
        self.vendor = vendor
        self.mapping_url = mapping_url
        self.regex = re.compile(regex)
        self.func = func

    def load_mapping(self):
        key = "javascript.errormapping:%s" % self.vendor
        mapping = cache.get(key)
        cached_rv = None
        if mapping is not None:
            ts, cached_rv = json.loads(mapping)
            if not is_expired(ts):
                return cached_rv

        try:
            http_session = http.build_session()
            response = http_session.get(
                self.mapping_url, allow_redirects=True, timeout=settings.SENTRY_SOURCE_FETCH_TIMEOUT
            )
            # Make sure we only get a 2xx to prevent caching bad data
            response.raise_for_status()
            data = response.json()
            cache.set(key, json.dumps([time.time(), data]), HARD_TIMEOUT)
        except Exception:
            if cached_rv is None:
                raise
            return cached_rv
        return data

    def try_process(self, exc):
        if not exc.get("value"):
            return False
        match = self.regex.search(exc["value"])
        if match is None:
            return False
        mapping = self.load_mapping()
        return self.func(exc, match, mapping)


def minified_error(vendor, mapping_url, regex):
    def decorator(f):
        error_processors[vendor] = Processor(vendor, mapping_url, regex, f)

    return decorator


@minified_error(
    vendor="react",
    mapping_url=REACT_MAPPING_URL,
    regex=r"Minified React error #(\d+); visit https?://[^?]+\?(\S+)",
)
def process_react_exception(exc, match, mapping):
    error_id, qs = match.groups()
    msg_format = mapping.get(error_id)
    if msg_format is None:
        return False

    arg_count = count_sprintf_parameters(msg_format)
    args = []
    for k, v in parse_qsl(qs, keep_blank_values=True):
        if k == "args[]":
            if isinstance(v, bytes):
                v = v.decode("utf-8", "replace")
            args.append(v)

    # Due to truncated error messages we sometimes might not be able to
    # get all arguments.  In that case we fill up missing parameters for
    # the format string with <redacted>.
    args = tuple(args + ["<redacted>"] * (arg_count - len(args)))[:arg_count]
    exc["value"] = msg_format % args

    return True


def rewrite_exception(data):
    """Rewrite an exception in an event if needed.  Updates the exception
    in place and returns `True` if a modification was performed or `False`
    otherwise.
    """
    rv = False
    for exc in get_path(data, "exception", "values", filter=True, default=()):
        for processor in error_processors.values():
            try:
                if processor.try_process(exc):
                    rv = True
                    break
            except Exception as e:
                logger.error('Failed to run processor "%s": %s', processor.vendor, e, exc_info=True)
                data.setdefault("_metrics", {})["flag.processing.error"] = True

    return rv
