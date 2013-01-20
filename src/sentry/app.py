"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings
from sentry.utils.imports import import_string
from threading import local


class State(local):
    request = None


def get_buffer(path, options):
    cls = import_string(path)
    if cls is None:
        raise ImportError('Unable to find module %s' % path)
    return cls(**options)

buffer = get_buffer(settings.BUFFER, settings.BUFFER_OPTIONS)
env = State()
