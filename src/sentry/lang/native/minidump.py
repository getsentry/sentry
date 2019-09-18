from __future__ import absolute_import

import logging

import dateutil.parser as dp
from msgpack import unpack, Unpacker, UnpackException, ExtraData

from sentry.utils.safe import get_path, setdefault_path
from sentry.utils import json

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


def decode_payload(encoded_data, max_size=None, multiple=False):
    """This decodes an encoded payload (msgpack or json)"""
    if max_size is not None and encoded_data.size > max_size:
        return

    leading = encoded_data.readline().strip()
    encoded_data.seek(0, 0)

    # This is okay because all spaces, opening brace and bracket are characters
    # that encode into a single integer (ascii code < 127).  This means we can
    # use this information to determine JSON from msgpack.
    is_json = leading.startswith((b'{', b'['))

    rv = None
    if multiple:
        rv = []

    if is_json:
        try:
            if multiple:
                for line in encoded_data:
                    rv.append(json.loads(line))
            else:
                rv = json.load(encoded_data)
        except (IOError, ValueError), e:
            minidumps_logger.exception(e)
    else:
        try:
            if multiple:
                rv = list(Unpacker(encoded_data))
            else:
                rv = unpack(encoded_data)
        except (UnpackException, ExtraData), e:
            minidumps_logger.exception(e)

    return rv


def merge_attached_event(encoded_event_file, data):
    """
    Merges an event payload attached in the ``__sentry-event`` attachment.
    """
    event = decode_payload(encoded_event_file, MAX_MSGPACK_BREADCRUMB_SIZE_BYTES)
    if event is None:
        return

    for key in event:
        value = event.get(key)
        if value is not None:
            data[key] = value


def merge_attached_breadcrumbs(encoded_breadcrumbs_file, data):
    """
    Merges breadcrumbs attached in the ``__sentry-breadcrumbs`` attachment(s).
    """
    breadcrumbs = decode_payload(encoded_breadcrumbs_file, MAX_MSGPACK_BREADCRUMB_SIZE_BYTES, multiple=True)
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
