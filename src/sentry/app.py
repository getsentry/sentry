"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings
from sentry.utils.imports import import_string
from threading import local


class State(local):
    request = None
    data = {}

env = State()


def get_instance(path, options):
    cls = import_string(path)
    return cls(**options)


buffer = get_instance(settings.SENTRY_BUFFER, settings.SENTRY_BUFFER_OPTIONS)
quotas = get_instance(settings.SENTRY_QUOTAS, settings.SENTRY_QUOTA_OPTIONS)
search = get_instance(settings.SENTRY_SEARCH, settings.SENTRY_SEARCH_OPTIONS)
