"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings as dj_settings
from sentry.conf import settings
from sentry.utils.imports import import_string
from threading import local


class State(local):
    request = None
    data = {}


def get_instance(path, options):
    cls = import_string(path)
    return cls(**options)

buffer = get_instance(settings.BUFFER, settings.BUFFER_OPTIONS)
env = State()

# XXX: support for Sentry's USE_QUEUE setting
dj_settings.CELERY_ALWAYS_EAGER = not settings.USE_QUEUE
