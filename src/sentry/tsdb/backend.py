"""
sentry.tsdb.backend
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from collections import defaultdict
from django.conf import settings
from django.utils import timezone
from enum import Enum
from nydus.db import create_cluster

ONE_MINUTE = 60
ONE_HOUR = ONE_MINUTE * 60
ONE_DAY = ONE_HOUR * 24


ROLLUPS = (
    # time in seconds, samples to keep
    # (10, 30),  # 5 minutes at 10 seconds
    # (ONE_MINUTE, 120),  # 2 hours at 1 minute
    (ONE_HOUR, 24),  # 1 days at 1 hour
    (ONE_DAY, 30),  # 30 days at 1 day
)


class TSDBModel(Enum):
    project = 1
    project_tag_key = 2
    project_tag_value = 3
    group = 4
    group_tag_key = 5
    group_tag_value = 6


class RedisTSDB(object):
    """
    A time series storage implementation which maps types + normalized epochs
    to hash buckets.

    Since each hash keyspace is an epoch, TTLs are applied to the entire bucket.

    This ends up looking something like the following inside of Redis:

    {
        "TSDBModel:epoch": {
            "Key": Count
        }
    }

    In our case, this translates to:

    {
        "Group:epoch": {
            "GroupID": Count
        }
    }
    """
    def __init__(self, rollups=ROLLUPS, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS

        options.setdefault('hosts', {
            0: {},
        })
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })
        self.rollups = rollups
        self.prefix = options.get('prefix', 'ts:')

    def normalize_to_epoch(self, timestamp, seconds):
        """
        Given a ``timestamp`` (datetime object) normalize the datetime object
        ``timestamp`` to an epoch timestmap (integer).

        i.e. if the rollup is minutes, the resulting timestamp would have
        the seconds and microseconds rounded down.
        """
        epoch = int(timestamp.strftime('%s'))
        return epoch - (epoch % seconds)

    def get_optimal_rollup(self, start_timestamp, end_timestamp):
        num_seconds = int(end_timestamp.strftime('%s')) - int(start_timestamp.strftime('%s'))

        # calculate the highest rollup within time range
        for rollup, samples in self.rollups:
            if rollup * samples >= num_seconds:
                return rollup
        return self.rollups[-1][0]

    def make_key(self, model, epoch):
        return '{0}:{1}:{2}'.format(self.prefix, model.value, epoch)

    def incr(self, model, key, timestamp=None, count=1):
        self.incr_multi([(model, key)], timestamp, count)

    def incr_multi(self, items, timestamp=None, count=1):
        """
        Increment project ID=1 and group ID=5:

        >>> incr_multi([(TimeSeriesModel.project, 1), (TimeSeriesModel.group, 5)])
        """
        make_key = self.make_key
        normalize_to_epoch = self.normalize_to_epoch
        if timestamp is None:
            timestamp = timezone.now()

        with self.conn.map() as conn:
            for rollup, max_values in self.rollups:
                epoch = normalize_to_epoch(timestamp, rollup)

                for model, key in items:
                    hash_key = make_key(model, epoch)
                    conn.hincrby(hash_key, key, count)
                    conn.expire(hash_key, rollup * max_values)

    def get_range(self, model, keys, start, end, rollup=None):
        """
        To get a range of data for group ID=[1, 2, 3]:

        >>> now = timezone.now()
        >>> get_keys(TimeSeriesModel.group, [1, 2, 3],
        >>>          start=now - timedelta(days=1),
        >>>          end=now)
        """
        normalize_to_epoch = self.normalize_to_epoch
        make_key = self.make_key

        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        # generate keys to fetch
        start_epoch = normalize_to_epoch(start, rollup)
        end_epoch = normalize_to_epoch(end, rollup)

        hash_keys = []
        for x in range(start_epoch, end_epoch + 1, rollup):
            hash_keys.append((x, make_key(model, x)))

        results = []
        with self.conn.map() as conn:
            for epoch, hash_key in hash_keys:
                results.append((epoch, keys, conn.hmget(hash_key, *keys)))

        results_by_key = defaultdict(dict)
        for epoch, keys, data in results:
            for key, count in zip(keys, data):
                results_by_key[key][epoch] = int(count or 0)

        for key, points in results_by_key.iteritems():
            results_by_key[key] = sorted(points.items())
        return results_by_key
