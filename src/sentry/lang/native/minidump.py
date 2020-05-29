from __future__ import absolute_import

import logging

from sentry.utils.safe import get_path

minidumps_logger = logging.getLogger("sentry.minidumps")

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = "event.minidump"

MAX_MSGPACK_BREADCRUMB_SIZE_BYTES = 50000
MAX_MSGPACK_EVENT_SIZE_BYTES = 100000


def is_minidump_event(data):
    """
    Checks whether an event indicates that it has an associated minidump.

    This requires the event to have a special marker payload. It is written by
    ``write_minidump_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "minidump"
