"""
sentry.tsdb.base
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from enum import Enum

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


ROLLUPS = (
    # time in seconds, samples to keep
    (10, 30),  # 5 minute at 10 seconds
    (ONE_HOUR, ONE_DAY * 7),  # 1 days at 1 hour
    # (ONE_DAY, 30),  # 30 days at 1 day
)


class TSDBModel(Enum):
    project = 1
    project_tag_key = 2
    project_tag_value = 3
    group = 4
    group_tag_key = 5
    group_tag_value = 6


class BaseTSDB(object):
    models = TSDBModel

    def __init__(self, rollups=ROLLUPS):
        self.rollups = rollups

    def normalize_to_epoch(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch timestmap (integer).

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        epoch = int(timestamp.strftime('%s'))
        return epoch - (epoch % seconds)

    def normalize_to_rollup(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch rollup (integer).
        """
        epoch = int(timestamp.strftime('%s'))
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
        >>> get_keys(TimeSeriesModel.group, [1, 2, 3],
        >>>          start=now - timedelta(days=1),
        >>>          end=now)
        """
        raise NotImplementedError

    def get_sums(self, model, keys, start, end, rollup=None):
        range_set = self.get_range(model, keys, start, end, rollup)
        sum_set = dict(
            (key, sum(p for _, p in points))
            for (key, points) in range_set.iteritems()
        )
        return sum_set
