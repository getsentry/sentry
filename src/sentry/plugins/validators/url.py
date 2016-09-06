from __future__ import absolute_import

from sentry.http import is_valid_url


def URLValidator(value, **kwargs):
    return is_valid_url(value)
