"""
sentry.client.log
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.client.base import SentryClient

import logging
import sys

class LoggingSentryClient(SentryClient):
    logger_name = 'sentry'
    default_level = logging.ERROR
    
    def __init__(self, *args, **kwargs):
        super(LoggingSentryClient, self).__init__(*args, **kwargs)
        self.logger = logging.getLogger(self.logger_name)
    
    def send(self, **kwargs):
        exc_info = sys.exc_info()
        try:
            self.logger.log(kwargs.pop('level', None) or self.default_level,
                            kwargs.pop('message', None) or exc_info[0],
                            exc_info=exc_info, extra=kwargs)
        finally:
            del exc_info
