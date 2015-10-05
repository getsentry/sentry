from __future__ import absolute_import

from ipaddr import IPAddress


def validate_ip(value, required=True):
    if not required and not value:
        return

    # will raise a ValueError
    IPAddress(value)
    return value
