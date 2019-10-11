from __future__ import absolute_import

import logging

import dateutil.parser as dp
from msgpack import unpack, Unpacker, UnpackException, ExtraData

from sentry.utils.safe import get_path, setdefault_path

minidumps_logger = logging.getLogger("sentry.minidumps")

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = "event.minidump"

MAX_MSGPACK_BREADCRUMB_SIZE_BYTES = 50000
MAX_MSGPACK_EVENT_SIZE_BYTES = 100000


def write_minidump_placeholder(data):
    """
    Writes a placeholder to indicate that this event has an associated minidump.

    This will indicate to the ingestion pipeline that this event will need to be
    processed. The payload can be checked via ``is_minidump_event``.
    """
    # Minidump events must be native platform.
    data["platform"] = "native"

    # Assume that this minidump is the result of a crash and assign the fatal
    # level. Note that the use of `setdefault` here doesn't generally allow the
    # user to override the minidump's level as processing will overwrite it
    # later.
    setdefault_path(data, "level", value="fatal")

    # Create a placeholder exception. This signals normalization that this is an
    # error event and also serves as a placeholder if processing of the minidump
    # fails.
    exception = {
        "type": "Minidump",
        "value": "Invalid Minidump",
        "mechanism": {"type": "minidump", "handled": False, "synthetic": True},
    }
    data["exception"] = {"values": [exception]}


def is_minidump_event(data):
    """
    Checks whether an event indicates that it has an associated minidump.

    This requires the event to have a special marker payload. It is written by
    ``write_minidump_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "minidump"


def merge_attached_event(mpack_event, data):
    """
    Merges an event payload attached in the ``__sentry-event`` attachment.
    """
    size = mpack_event.size
    if size == 0 or size > MAX_MSGPACK_EVENT_SIZE_BYTES:
        return

    try:
        event = unpack(mpack_event)
    except (TypeError, ValueError, UnpackException, ExtraData) as e:
        minidumps_logger.exception(e)
        return

    for key in event:
        value = event.get(key)
        if value is not None:
            data[key] = value


def merge_attached_breadcrumbs(mpack_breadcrumbs, data):
    """
    Merges breadcrumbs attached in the ``__sentry-breadcrumbs`` attachment(s).
    """
    size = mpack_breadcrumbs.size
    if size == 0 or size > MAX_MSGPACK_BREADCRUMB_SIZE_BYTES:
        return

    try:
        unpacker = Unpacker(mpack_breadcrumbs)
        breadcrumbs = list(unpacker)
    except (TypeError, ValueError, UnpackException, ExtraData) as e:
        minidumps_logger.exception(e)
        return

    if not breadcrumbs:
        return

    current_crumbs = data.get("breadcrumbs")
    if not current_crumbs:
        data["breadcrumbs"] = breadcrumbs
        return

    current_crumb = next(
        (
            c
            for c in reversed(current_crumbs)
            if isinstance(c, dict) and c.get("timestamp") is not None
        ),
        None,
    )
    new_crumb = next(
        (
            c
            for c in reversed(breadcrumbs)
            if isinstance(c, dict) and c.get("timestamp") is not None
        ),
        None,
    )

    # cap the breadcrumbs to the highest count of either file
    cap = max(len(current_crumbs), len(breadcrumbs))

    if current_crumb is not None and new_crumb is not None:
        if dp.parse(current_crumb["timestamp"]) > dp.parse(new_crumb["timestamp"]):
            data["breadcrumbs"] = breadcrumbs + current_crumbs
        else:
            data["breadcrumbs"] = current_crumbs + breadcrumbs
    else:
        data["breadcrumbs"] = current_crumbs + breadcrumbs

    data["breadcrumbs"] = data["breadcrumbs"][-cap:]
