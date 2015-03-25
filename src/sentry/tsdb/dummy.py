"""
sentry.tsdb.dummy
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.tsdb.base import BaseTSDB


class DummyTSDB(BaseTSDB):
    """
    A no-op time-series storage.
    """
    def incr(self, model, key, timestamp=None, count=1):
        pass

    def get_range(self, model, keys, start, end, rollup=None):
        return dict((k, []) for k in keys)
