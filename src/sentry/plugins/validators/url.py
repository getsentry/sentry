from __future__ import absolute_import

from sentry.exceptions import PluginError
from sentry.http import is_valid_url


def URLValidator(value, **kwargs):
    if not value.startswith(('http://', 'https://')):
        raise PluginError('Not a valid URL.')
    if not is_valid_url(value):
        raise PluginError('Not a valid URL.')
    return value
