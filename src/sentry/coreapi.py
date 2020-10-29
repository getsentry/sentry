# TODO: We should make the API a class, and UDP/HTTP just inherit from it
#       This will make it so we can more easily control logging with various
#       metadata (rather than generic log messages which aren't useful).
from __future__ import absolute_import, print_function

import logging
import re

from time import time

from sentry.attachments import attachment_cache
from sentry.cache import default_cache
from sentry.tasks.store import preprocess_event, preprocess_event_from_reprocessing
from sentry.utils.cache import cache_key_for_event
from sentry.utils.canonical import CANONICAL_TYPES


_dist_re = re.compile(r"^[a-zA-Z0-9_.-]+$")
logger = logging.getLogger("sentry.api")


class APIError(Exception):
    http_status = 400
    msg = "Invalid request"
    name = None

    def __init__(self, msg=None, name=None):
        if msg:
            self.msg = msg
        if self.name:
            self.name = name

    def __str__(self):
        return self.msg or ""


class APIUnauthorized(APIError):
    http_status = 401
    msg = "Unauthorized"


class APIForbidden(APIError):
    http_status = 403


def insert_data_to_database_legacy(
    data, start_time=None, from_reprocessing=False, attachments=None
):
    """
    Yet another "fast path" to ingest an event without making it go
    through Relay. Please consider using functions from the ingest consumer
    instead, or, if you're within tests, to use `TestCase.store_event`.
    """

    # XXX(markus): Delete this function and merge with ingest consumer logic.

    if start_time is None:
        start_time = time()

    # we might be passed some subclasses of dict that fail dumping
    if isinstance(data, CANONICAL_TYPES):
        data = dict(data.items())

    cache_timeout = 3600
    cache_key = cache_key_for_event(data)
    default_cache.set(cache_key, data, cache_timeout)

    # Attachments will be empty or None if the "event-attachments" feature
    # is turned off. For native crash reports it will still contain the
    # crash dump (e.g. minidump) so we can load it during processing.
    if attachments is not None:
        attachment_cache.set(cache_key, attachments, cache_timeout)

    task = from_reprocessing and preprocess_event_from_reprocessing or preprocess_event
    task.delay(cache_key=cache_key, start_time=start_time, event_id=data["event_id"])
