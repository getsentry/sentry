"""
sentry.buffer.inprocess
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.buffer import Buffer


class InProcessBuffer(Buffer):
    """
    In-process buffer which computes changes in real-time.

    **Note**: This does not actually buffer anything, and should only be used
              in development and testing environments.
    """
    def incr(self, model, columns, filters, extra=None):
        self.process(model, columns, filters, extra)
