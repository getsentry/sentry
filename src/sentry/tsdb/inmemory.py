"""
sentry.tsdb.inmemory
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from collections import Counter, defaultdict
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

        for key, points in six.iteritems(results_by_key):
            results_by_key[key] = sorted(points.items())
        return dict(results_by_key)

    def record(self, model, key, values, timestamp=None):
        if timestamp is None:
            timestamp = timezone.now()

        for rollup, max_values in self.rollups:
            r = self.normalize_to_rollup(timestamp, rollup)
            self.sets[model][key][r].update(values)

    def get_distinct_counts_series(self, model, keys, start, end=None, rollup=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key in keys:
            source = self.sets[model][key]
            counts = results[key] = []
            for timestamp in series:
                r = self.normalize_ts_to_rollup(timestamp, rollup)
                counts.append((timestamp, len(source[r])))

        return results

    def get_distinct_counts_totals(self, model, keys, start, end=None, rollup=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key in keys:
            source = self.sets[model][key]
            values = set()
            for timestamp in series:
                r = self.normalize_ts_to_rollup(timestamp, rollup)
                values.update(source[r])
            results[key] = len(values)

        return results

    def get_distinct_counts_union(self, model, keys, start, end=None, rollup=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        values = set()
        for key in keys:
            source = self.sets[model][key]
            for timestamp in series:
                r = self.normalize_ts_to_rollup(timestamp, rollup)
                values.update(source[r])

        return len(values)

    def flush(self):
        # model => key => timestamp = count
        self.data = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

        # self.sets[model][key][rollup] = set of elements
        self.sets = defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(
                    set,
                ),
            ),
        )

        # self.frequencies[model][key][rollup] = Counter()
        self.frequencies = defaultdict(
            lambda: defaultdict(
                lambda: defaultdict(
                    Counter,
                )
            ),
        )

    def record_frequency_multi(self, requests, timestamp=None):
        if timestamp is None:
            timestamp = timezone.now()

        for model, request in requests:
            for key, items in request.items():
                items = {k: float(v) for k, v in items.items()}
                source = self.frequencies[model][key]
                for rollup, _ in self.rollups:
                    source[self.normalize_to_rollup(timestamp, rollup)].update(items)

    def get_most_frequent(self, model, keys, start, end=None, rollup=None, limit=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key in keys:
            result = results[key] = Counter()
            source = self.frequencies[model][key]
            for timestamp in series:
                result.update(source[self.normalize_ts_to_rollup(timestamp, rollup)])

        for key, counter in results.items():
            results[key] = counter.most_common(limit)

        return results

    def get_frequency_series(self, model, items, start, end=None, rollup=None):
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        results = {}
        for key, members in items.items():
            result = results[key] = []
            source = self.frequencies[model][key]
            for timestamp in series:
                scores = source[self.normalize_ts_to_rollup(timestamp, rollup)]
                result.append((
                    timestamp,
                    {k: scores.get(k, 0.0) for k in members},
                ))

        return results

    def get_frequency_totals(self, model, items, start, end=None, rollup=None):
        results = {}

        for key, series in six.iteritems(self.get_frequency_series(model, items, start, end, rollup)):
            result = results[key] = {}
            for timestamp, scores in series:
                for member, score in scores.items():
                    result[member] = result.get(member, 0.0) + score

        return results
