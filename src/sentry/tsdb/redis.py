"""
sentry.tsdb.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from collections import defaultdict
from django.conf import settings
from django.utils import timezone
from hashlib import md5
from nydus.db import create_cluster

from sentry.tsdb.base import BaseTSDB


class RedisTSDB(BaseTSDB):
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
    def __init__(self, hosts=None, router=None, prefix='ts:', **kwargs):
        # inherit default options from REDIS_OPTIONS
        defaults = settings.SENTRY_REDIS_OPTIONS

        if hosts is None:
            hosts = defaults.get('hosts', {0: {}})

        if router is None:
            router = defaults.get('router', 'nydus.db.routers.keyvalue.PartitionRouter')

        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': router,
            'hosts': hosts,
        })
        self.prefix = prefix
        super(RedisTSDB, self).__init__(**kwargs)

    def make_key(self, model, epoch):
        return '{0}:{1}:{2}'.format(self.prefix, model.value, epoch)

    def get_model_key(self, key):
        # We specialize integers so that a pure int-map can be optimized by
        # Redis, whereas long strings (say tag values) will store in a more
        # efficient hashed format.
        if not isinstance(key, (int, long)):
            return md5(repr(key)).hexdigest()
        return key

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
                    conn.hincrby(hash_key, self.get_model_key(key), count)
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
                mapped_keys = [self.get_model_key(k) for k in keys]
                results.append((epoch, keys, conn.hmget(hash_key, *mapped_keys)))

        results_by_key = defaultdict(dict)
        for epoch, keys, data in results:
            for key, count in zip(keys, data):
                results_by_key[key][epoch] = int(count or 0)

        for key, points in results_by_key.iteritems():
            results_by_key[key] = sorted(points.items())
        return results_by_key
