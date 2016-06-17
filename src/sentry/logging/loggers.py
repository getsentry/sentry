"""
sentry.logging.loggers
~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from structlog._loggers import PrintLogger, PrintLoggerFactory
from structlog._utils import until_not_interrupted


class FlatLoggerFactory(PrintLoggerFactory):
    def __call__(self, *args):
        return FlatLogger(self._file)


class FlatLogger(PrintLogger):
    def msg(self, message):
        """
        Print *message* without a newline.
        """
        with self._lock:
            until_not_interrupted(self._write, message)
            until_not_interrupted(self._flush)
