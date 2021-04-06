"""
Generic way to sign and unsign data for use in urls.
"""

import base64

from django.core.signing import TimestampSigner
from django.utils.encoding import force_bytes, force_text

from sentry.utils.json import dumps, loads

SALT = "sentry-generic-signing"


def sign(**kwargs):
    """
    Signs all passed kwargs and produces a base64 string which may be passed to
    unsign which will verify the string has not been tampered with.
    """
    return force_text(
        base64.urlsafe_b64encode(
            TimestampSigner(salt=SALT).sign(dumps(kwargs)).encode("utf-8")
        ).rstrip(b"=")
    )


def unsign(data, max_age=60 * 60 * 24 * 2):
    """
    Unsign a signed base64 string. Accepts the base64 value as a string or bytes
    """
    return loads(
        TimestampSigner(salt=SALT).unsign(urlsafe_b64decode(data).decode("utf-8"), max_age=max_age)
    )


def urlsafe_b64decode(b64string):
    b64string = force_bytes(b64string)
    padded = b64string + b"=" * (4 - len(b64string) % 4)
    return base64.urlsafe_b64decode(padded)
