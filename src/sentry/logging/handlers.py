"""
sentry.logging.handlers
~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from logging import StreamHandler


class StructLogHandler(StreamHandler):
    def __init__(self):
        from structlog import get_logger
        self.logger = get_logger()
        super(StructLogHandler, self).__init__()

    def emit(self, record):
        self.logger.log(record.levelno, record.msg, name=record.name)
