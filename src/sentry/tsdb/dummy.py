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

    def incr(self, model, key, timestamp=None, count=1, environment_id=None):
        pass

    def merge(self, model, destination, sources, timestamp=None, environment_ids=None):
        pass

    def delete(self, models, keys, start=None, end=None, timestamp=None, environment_ids=None):
        pass

    def get_range(self, model, keys, start, end, rollup=None, environment_id=None):
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def record(self, model, key, values, timestamp=None, environment_id=None):
        pass

    def get_distinct_counts_series(self, model, keys, start, end=None,
                                   rollup=None, environment_id=None):
        _, series = self.get_optimal_rollup_series(start, end, rollup)
        return {k: [(ts, 0) for ts in series] for k in keys}

    def get_distinct_counts_totals(self, model, keys, start, end=None,
                                   rollup=None, environment_id=None):
        return {k: 0 for k in keys}

    def get_distinct_counts_union(self, model, keys, start, end=None,
                                  rollup=None, environment_id=None):
        return 0

    def merge_distinct_counts(self, model, destination, sources,
                              timestamp=None, environment_ids=None):
        pass

    def delete_distinct_counts(self, models, keys, start=None, end=None,
                               timestamp=None, environment_ids=None):
        pass

    def record_frequency_multi(self, requests, timestamp=None, environment_id=None):
        pass

    def get_most_frequent(self, model, keys, start, end=None,
                          rollup=None, limit=None, environment_id=None):
        return {key: [] for key in keys}

    def get_most_frequent_series(self, model, keys, start, end=None,
                                 rollup=None, limit=None, environment_id=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)
        return {key: [(timestamp, {}) for timestamp in series] for key in keys}

    def get_frequency_series(self, model, items, start, end=None, rollup=None, environment_id=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key, members in items.items():
            result = results[key] = []
            for timestamp in series:
                result.append((timestamp, {k: 0.0 for k in members}, ))

        return results

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        results = {}
        for key, members in items.items():
            results[key] = {member: 0.0 for member in members}
        return results

    def merge_frequencies(self, model, destination, sources, timestamp=None, environment_ids=None):
        pass

    def delete_frequencies(self, models, keys, start=None, end=None,
                           timestamp=None, environment_ids=None):
        pass
