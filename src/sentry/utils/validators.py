from __future__ import absolute_import

import ipaddress
import six
import uuid

from django.utils.encoding import force_text


def validate_ip(value, required=True):
    if not required and not value:
        return

    # will raise a ValueError
    ipaddress.ip_network(six.text_type(value), strict=False)
    return value


def is_float(var):
    try:
        float(var)
    except (TypeError, ValueError):
        return False
    return True


def normalize_event_id(value):
    try:
        return uuid.UUID(force_text(value)).hex
    except (TypeError, AttributeError, ValueError):
        return None


def is_event_id(value):
    return normalize_event_id(value) is not None
