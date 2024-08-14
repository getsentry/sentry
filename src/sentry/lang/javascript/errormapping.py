from __future__ import annotations

import logging
import random
import re
import time
from urllib.parse import parse_qsl

import orjson
from django.conf import settings
from django.core.cache import cache

from sentry import http
from sentry.utils.meta import Meta
from sentry.utils.safe import get_path
from sentry.utils.strings import count_sprintf_parameters

logger = logging.getLogger(__name__)

SOFT_TIMEOUT = 600
SOFT_TIMEOUT_FUZZINESS = 10
HARD_TIMEOUT = 7200

REACT_MAPPING_URL = (
    "https://raw.githubusercontent.com/facebook/react/master/scripts/error-codes/codes.json"
)

# Regex for React error messages.
# * The `(\d+)` group matches the error code
# * The `(?:\?(\S+))?` group optionally matches a query (non-capturing),
#   and `(\S+)` matches the query parameters.
REACT_ERROR_REGEX = r"Minified React error #(\d+); visit https?://[^?]+(?:\?(\S+))?"

error_processors: dict[str, Processor] = {}


def is_expired(ts):
    return ts > (time.time() - SOFT_TIMEOUT - random.random() * SOFT_TIMEOUT_FUZZINESS)


class Processor:
    def __init__(self, vendor: str, mapping_url, regex, func):
        self.vendor: str = vendor
        self.mapping_url = mapping_url
        self.regex = re.compile(regex)
        self.func = func

    def load_mapping(self):
        key = f"javascript.errormapping:{self.vendor}"
        mapping = cache.get(key)
        cached_rv = None
        if mapping is not None:
            ts, cached_rv = orjson.loads(mapping)
            if not is_expired(ts):
                return cached_rv

        try:
            with http.build_session() as session:
                response = session.get(
                    self.mapping_url,
                    allow_redirects=True,
                    timeout=settings.SENTRY_SOURCE_FETCH_TIMEOUT,
                )
                # Make sure we only get a 2xx to prevent caching bad data
                response.raise_for_status()
            data = response.json()
            cache.set(key, orjson.dumps([time.time(), data]).decode(), HARD_TIMEOUT)
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
    regex=REACT_ERROR_REGEX,
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
            args.append(v)

    # Due to truncated error messages we sometimes might not be able to
    # get all arguments.  In that case we fill up missing parameters for
    # the format string with <redacted>.
    args_t = tuple(args + ["<redacted>"] * (arg_count - len(args)))[:arg_count]
    exc["value"] = msg_format % args_t

    return True


def rewrite_exception(data):
    """Rewrite an exception in an event if needed.  Updates the exception
    in place and returns `True` if a modification was performed or `False`
    otherwise.
    """
    meta = Meta(data.get("_meta"))
    rv = False

    values_meta = meta.enter("exception", "values")
    for index, exc in enumerate(get_path(data, "exception", "values", default=())):
        if exc is None:
            continue

        for processor in error_processors.values():
            try:
                original_value = exc.get("value")
                if processor.try_process(exc):
                    values_meta.enter(index, "value").add_remark(
                        {"rule_id": f"@processing:{processor.vendor}", "type": "s"}, original_value
                    )
                    rv = True
                    break
            except Exception as e:
                logger.exception('Failed to run processor "%s": %s', processor.vendor, e)
                data.setdefault("_metrics", {})["flag.processing.error"] = True

    if meta.raw():
        data["_meta"] = meta.raw()

    return rv
