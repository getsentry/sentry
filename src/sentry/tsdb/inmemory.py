"""
sentry.tsdb.inmemory
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from collections import defaultdict
from datetime import timedelta
from django.utils import timezone

from sentry.tsdb.base import BaseTSDB


class InMemoryTSDB(BaseTSDB):
    """
    An in-memory time-series storage.

    This should not be used in production as it will leak memory.
    """
    def __init__(self, *args, **kwargs):
        super(InMemoryTSDB, self).__init__(*args, **kwargs)
        self.flush()

    def incr(self, model, key, timestamp=None, count=1):
        if timestamp is None:
            timestamp = timezone.now()

        for rollup, max_values in self.rollups:
            norm_epoch = self.normalize_to_rollup(timestamp, rollup)
            self.data[model][key][norm_epoch] += count

    def get_range(self, model, keys, start, end, rollup=None):
        normalize_to_epoch = self.normalize_to_epoch
        normalize_to_rollup = self.normalize_to_rollup

        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        results = []
        timestamp = end
        while timestamp >= start:
            real_epoch = normalize_to_epoch(timestamp, rollup)
            norm_epoch = normalize_to_rollup(timestamp, rollup)

            for key in keys:
                value = self.data[model][key][norm_epoch]
                results.append((real_epoch, key, value))

            timestamp = timestamp - timedelta(seconds=rollup)

        results_by_key = defaultdict(dict)
        for epoch, key, count in results:
            results_by_key[key][epoch] = int(count or 0)

        for key, points in results_by_key.iteritems():
            results_by_key[key] = sorted(points.items())
        return dict(results_by_key)

    def flush(self):
        # model => key => timestamp = count
        self.data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
