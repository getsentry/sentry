"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging


class StructLogHandler(logging.StreamHandler):
    def __init__(self, *args, **kwargs):
        from structlog import get_logger
        super(StructLogHandler, self).__init__(*args, **kwargs)
        self._structlog = get_logger()

    def emit(self, record):
        kwargs = {
            'name': record.name,
        }
        if record.exc_info:
            kwargs['exc_info'] = record.exc_info
        log = getattr(self._structlog, logging.getLevelName(record.levelno).lower(), None)
        if log:
            log(record.msg, **kwargs)
