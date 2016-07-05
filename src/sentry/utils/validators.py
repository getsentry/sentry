from __future__ import absolute_import

import re
from ipaddr import IPAddress

EVENT_ID_RE = re.compile(r'^[a-fA-F0-9]{32}$')


def validate_ip(value, required=True):
    if not required and not value:
        return

    # will raise a ValueError
    IPAddress(value)
    return value


def is_float(var):
    try:
        float(var)
    except (TypeError, ValueError):
        return False
    return True


def is_event_id(value):
    try:
        return bool(EVENT_ID_RE.match(value))
    except TypeError:
        return False
