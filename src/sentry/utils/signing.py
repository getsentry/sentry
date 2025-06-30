"""
Generic way to sign and unsign data for use in urls.
"""

import base64
from typing import Any

from django.core.signing import TimestampSigner

from sentry.utils.json import dumps, loads

SALT = "sentry-generic-signing"


def sign(*, salt: str = SALT, **kwargs: object) -> str:
    """
    Signs all passed kwargs and produces a base64 string which may be passed to
    unsign which will verify the string has not been tampered with.
    """
    return (
        base64.urlsafe_b64encode(TimestampSigner(salt=salt).sign(dumps(kwargs)).encode())
        .rstrip(b"=")
        .decode()
    )


def unsign(data: str | bytes, salt: str = SALT, max_age: int = 60 * 60 * 24 * 2) -> dict[str, Any]:
    """
    Unsign a signed base64 string. Accepts the base64 value as a string or bytes
    """
    return loads(
        TimestampSigner(salt=salt).unsign(urlsafe_b64decode(data).decode(), max_age=max_age)
    )


def urlsafe_b64decode(b64string: str | bytes) -> bytes:
    if isinstance(b64string, str):
        b64string = b64string.encode()
    padded = b64string + b"=" * (4 - len(b64string) % 4)
    return base64.urlsafe_b64decode(padded)
