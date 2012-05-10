"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.conf import settings
from sentry.utils.imports import import_string


def get_buffer(path, options):
    cls = import_string(path)
    return cls(**options)

buffer = get_buffer(settings.BUFFER, settings.BUFFER_OPTIONS)
