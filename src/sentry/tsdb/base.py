"""
sentry.tsdb.base
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from enum import Enum

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


class TSDBModel(Enum):
    internal = 0

    # number of events seen specific to grouping
    project = 1
    project_tag_key = 2
    project_tag_value = 3
    group = 4
    group_tag_key = 5
    group_tag_value = 6

    # the number of events sent to the server
    project_total_received = 100
    # the number of events rejected due to rate limiting
    project_total_rejected = 101
    # the number of operations
    project_operations = 102
    # the number of operations with an error state
    project_operation_errors = 103
    # the number of events blocked due to being blacklisted
    project_total_blacklisted = 104

    # the number of events sent to the server
    organization_total_received = 200
    # the number of events rejected due to rate limiting
    organization_total_rejected = 201
    # the number of events blocked due to being blacklisted
    organization_total_blacklisted = 202

    users_affected_by_event = 300


class BaseTSDB(object):
    models = TSDBModel

    def __init__(self, rollups=settings.SENTRY_TSDB_ROLLUPS):
        self.rollups = rollups

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def normalize_to_epoch(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch timestamp.

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        epoch = int(timestamp.strftime('%s'))
        return epoch - (epoch % seconds)

    def normalize_ts_to_epoch(self, epoch, seconds):
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return epoch - (epoch % seconds)

    def normalize_to_rollup(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize to an epoch rollup.
        """
        epoch = int(timestamp.strftime('%s'))
        return int(epoch / seconds)

    def normalize_ts_to_rollup(self, epoch, seconds):
        """
        Given a ``epoch`` normalize to an epoch rollup.
        """
        return int(epoch / seconds)

    def get_optimal_rollup(self, start_timestamp, end_timestamp):
        """
        Identify the lowest granularity rollup available within the given time
        range.
        """
        num_seconds = int(end_timestamp.strftime('%s')) - int(start_timestamp.strftime('%s'))

        # calculate the highest rollup within time range
        for rollup, samples in self.rollups:
            if rollup * samples >= num_seconds:
                return rollup
        return self.rollups[-1][0]

    def get_optimal_rollup_intervals(self, start, end, rollup=None):
        # NOTE: "optimal" here means "able to most closely reflect the upper
        # and lower bounds", not "able to construct the most efficient query"
        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        intervals = [self.normalize_to_epoch(start, rollup)]
        end_ts = int(end.strftime('%s'))  # XXX: HACK
        while intervals[-1] + rollup < end_ts:
            intervals.append(intervals[-1] + rollup)

        return rollup, intervals

    def calculate_expiry(self, rollup, samples, timestamp):
        """
        Calculate the expiration time for a rollup.

        :param rollup: rollup interval (in seconds)
        :param samples: number of samples to maintain
        :param timestamp: datetime used to calculate the rollup epoch
        """
        epoch = self.normalize_to_epoch(timestamp, rollup)
        return epoch + (rollup * samples)

    def incr(self, model, key, timestamp=None, count=1):
        """
        Increment project ID=1:

        >>> incr(TimeSeriesModel.project, 1)
        """
        raise NotImplementedError

    def incr_multi(self, items, timestamp=None, count=1):
        """
        Increment project ID=1 and group ID=5:

        >>> incr_multi([(TimeSeriesModel.project, 1), (TimeSeriesModel.group, 5)])
        """
        for model, key in items:
            self.incr(model, key, timestamp, count)

    def get_range(self, model, keys, start, end, rollup=None):
        """
        To get a range of data for group ID=[1, 2, 3]:

        Both ``start`` and ``end`` are inclusive.

        Returns a mapping of key => [(timestamp, count), ...].

        >>> now = timezone.now()
        >>> get_range([TSDBModel.group], [1, 2, 3],
        >>>           start=now - timedelta(days=1),
        >>>           end=now)
        """
        raise NotImplementedError

    def get_sums(self, model, keys, start, end, rollup=None):
        range_set = self.get_range(model, keys, start, end, rollup)
        sum_set = dict(
            (key, sum(p for _, p in points))
            for (key, points) in range_set.iteritems()
        )
        return sum_set

    def rollup(self, values, rollup):
        """
        Given a set of values (as returned from ``get_range``), roll them up
        using the ``rollup`` time (in seconds).
        """
        normalize_ts_to_epoch = self.normalize_ts_to_epoch
        result = {}
        for key, points in values.iteritems():
            result[key] = []
            last_new_ts = None
            for (ts, count) in points:
                new_ts = normalize_ts_to_epoch(ts, rollup)
                if new_ts == last_new_ts:
                    result[key][-1][1] += count
                else:
                    result[key].append([new_ts, count])
                    last_new_ts = new_ts
        return result

    def record_multi(self, items, timestamp=None):
        """
        Record an occurence of an item in a distinct counter.
        """
        raise NotImplementedError

    def get_distinct_counts_series(self, model, keys, start, end, rollup=None):
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        raise NotImplementedError

    def get_distinct_counts_totals(self, model, keys, start, end, rollup=None):
        """
        Count distinct items during a time range.
        """
        raise NotImplementedError
