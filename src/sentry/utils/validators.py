from __future__ import absolute_import

from ipaddr import IPAddress


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
