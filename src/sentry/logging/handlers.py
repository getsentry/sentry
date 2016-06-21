"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import logging

from structlog import get_logger

logger = get_logger()


class StructLogHandler(logging.StreamHandler):
    def emit(self, record):
        kwargs = {
            'name': record.name,
        }
        if record.exc_info:
            kwargs['exc_info'] = record.exc_info

        if record.args:
            if isinstance(record.args, dict):
                kwargs.update(record.args)
            else:
                kwargs['args'] = record.args

        # HACK(JTCunning): Calling structlog.log instead of the corresponding level
        # methods steps on the toes of django client loggers and their testing components.
        log = getattr(logger, logging.getLevelName(record.levelno).lower(), None)
        if log:
            log(record.msg, **kwargs)
        else:
            super(StructLogHandler, self).emit(record)
