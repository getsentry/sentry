"""
Generic way to sign and unsign data for use in urls.
"""
from __future__ import absolute_import

import base64

from django.core.signing import TimestampSigner
from sentry.utils.json import dumps, loads

SALT = "sentry-generic-signing"


def sign(**kwargs):
    return base64.urlsafe_b64encode(TimestampSigner(salt=SALT).sign(dumps(kwargs))).rstrip("=")


def unsign(data, max_age=60 * 60 * 24 * 2):
    return loads(TimestampSigner(salt=SALT).unsign(urlsafe_b64decode(data), max_age=max_age))


def urlsafe_b64decode(b64string):
    padded = b64string + b"=" * (4 - len(b64string) % 4)
    return base64.urlsafe_b64decode(padded)
