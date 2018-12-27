"""
Generic way to sign and unsign data for use in urls.
"""
from __future__ import absolute_import

from base64 import urlsafe_b64encode, urlsafe_b64decode
from django.core.signing import TimestampSigner
from sentry.utils.json import dumps, loads

SALT = 'sentry-generic-signing'


def sign(**kwargs):
    return urlsafe_b64encode(
        TimestampSigner(salt=SALT).sign(dumps(kwargs))
    ).rstrip('=')


def unsign(data, max_age=60 * 60 * 24 * 2):
    padding = len(data) % 4
    return loads(
        TimestampSigner(salt=SALT).unsign(
            urlsafe_b64decode(data + b'=' * (4 - padding)),
            max_age=max_age,
        )
    )
