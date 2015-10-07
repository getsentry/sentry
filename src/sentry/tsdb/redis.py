"""
sentry.tsdb.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import functools
import logging
import six

from binascii import crc32
from collections import defaultdict
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from hashlib import md5

from rb import Cluster

from sentry.exceptions import InvalidConfiguration
from sentry.tsdb.base import BaseTSDB
from sentry.utils.versioning import (
    Version,
    check_versions,
)


logger = logging.getLogger(__name__)


class RedisTSDB(BaseTSDB):
    """
    A time series storage implementation which maps types + normalized epochs
    to hash buckets.

    Since each hash keyspace is an epoch, TTLs are applied to the entire bucket.

    This ends up looking something like the following inside of Redis:

    {
        "TSDBModel:epoch:shard": {
            "Key": Count
        }
    }

    In our case, this translates to:

    {
        "Group:epoch:shard": {
            "GroupID": Count
        }
    }

    - ``vnodes`` controls the shard distribution and should ideally be set to
      the maximum number of physical hosts.
    """
    def __init__(self, hosts=None, prefix='ts:', vnodes=64, **kwargs):
        # inherit default options from REDIS_OPTIONS
        defaults = settings.SENTRY_REDIS_OPTIONS

        if hosts is None:
            hosts = defaults.get('hosts', {0: {}})

        self.cluster = Cluster(hosts)
        self.prefix = prefix
        self.vnodes = vnodes
        super(RedisTSDB, self).__init__(**kwargs)

    def validate(self):
        logger.info('Validating Redis version...')

        try:
            with self.cluster.all() as client:
                results = client.info()
        except Exception as e:
            # Any connection issues should be caught here.
            raise InvalidConfiguration(unicode(e))

        versions = {}
        for id, info in results.value.items():
            host = self.cluster.hosts[id]
            # NOTE: This assumes there is no routing magic going on here, and
            # all requests to this host are being served by the same database.
            key = '{host}:{port}'.format(host=host.host, port=host.port)
            versions[key] = Version(map(int, info['redis_version'].split('.', 3)))

        check_versions('Redis (TSDB)', versions, Version((2, 8, 9)), Version((3, 0, 4)))

    def make_key(self, model, epoch, model_key):
        if isinstance(model_key, six.integer_types):
            vnode = model_key % self.vnodes
        else:
            vnode = crc32(model_key) % self.vnodes

        return '{0}{1}:{2}:{3}'.format(self.prefix, model.value, epoch, vnode)

    def get_model_key(self, key):
        # We specialize integers so that a pure int-map can be optimized by
        # Redis, whereas long strings (say tag values) will store in a more
        # efficient hashed format.
        if not isinstance(key, six.integer_types):
            # enforce utf-8 encoding
            if isinstance(key, unicode):
                key = key.encode('utf-8')
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
        normalize_to_rollup = self.normalize_to_rollup
        if timestamp is None:
            timestamp = timezone.now()

        with self.cluster.map() as client:
            for rollup, max_values in self.rollups:
                norm_rollup = normalize_to_rollup(timestamp, rollup)
                for model, key in items:
                    model_key = self.get_model_key(key)
                    hash_key = make_key(model, norm_rollup, model_key)
                    client.hincrby(hash_key, model_key, count)
                    client.expireat(
                        hash_key,
                        self.calculate_expiry(rollup, max_values, timestamp),
                    )

    def get_range(self, model, keys, start, end, rollup=None):
        """
        To get a range of data for group ID=[1, 2, 3]:

        Start and end are both inclusive.

        >>> now = timezone.now()
        >>> get_keys(TimeSeriesModel.group, [1, 2, 3],
        >>>          start=now - timedelta(days=1),
        >>>          end=now)
        """
        normalize_to_epoch = self.normalize_to_epoch
        normalize_to_rollup = self.normalize_to_rollup
        make_key = self.make_key

        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        results = []
        timestamp = end
        with self.cluster.map() as client:
            while timestamp >= start:
                real_epoch = normalize_to_epoch(timestamp, rollup)
                norm_epoch = normalize_to_rollup(timestamp, rollup)

                for key in keys:
                    model_key = self.get_model_key(key)
                    hash_key = make_key(model, norm_epoch, model_key)
                    results.append((real_epoch, key,
                                    client.hget(hash_key, model_key)))

                timestamp = timestamp - timedelta(seconds=rollup)

        results_by_key = defaultdict(dict)
        for epoch, key, count in results:
            results_by_key[key][epoch] = int(count.value or 0)

        for key, points in results_by_key.iteritems():
            results_by_key[key] = sorted(points.items())
        return dict(results_by_key)

    def record_multi(self, items, timestamp=None):
        """
        Record an occurence of an item in a distinct counter.
        """
        if timestamp is None:
            timestamp = timezone.now()

        with self.cluster.fanout() as client:
            for model, key, values in items:
                c = client.target_key(key)
                for rollup, max_values in self.rollups:
                    expire = rollup * max_values  # XXX: This logic can lead to incorrect expiry values.

                    m = self.get_model_key(key)
                    k = self.make_key(model, self.normalize_to_rollup(timestamp, rollup), m)
                    c.pfadd(k, m, *values)
                    c.expire(k, expire)

        # TODO: Check to make sure these operations didn't fail, so we can
        # raise an error if there were issues.

    def _get_intervals(self, start, end, rollup=None):
        # NOTE: "optimal" here means "able to most closely reflect the upper
        # and lower bounds", not "able to construct the most efficient query"
        if rollup is None:
            rollup = self.get_optimal_rollup(start, end)

        intervals = [self.normalize_to_epoch(start, rollup)]
        end_ts = int(end.strftime('%s'))  # XXX: HACK
        while intervals[-1] + rollup < end_ts:
            intervals.append(intervals[-1] + rollup)

        return rollup, intervals

    def get_distinct_counts_series(self, model, keys, start, end, rollup=None):
        rollup, intervals = self._get_intervals(start, end, rollup)

        def get_key(key, timestamp):
            return self.make_key(
                model,
                self.normalize_ts_to_rollup(timestamp, rollup),
                self.get_model_key(key),
            )

        responses = {}
        with self.cluster.fanout() as client:
            for key in keys:
                make_key = functools.partial(get_key, key)
                c = client.target_key(key)
                responses[key] = [(timestamp, c.pfcount(make_key(timestamp))) for timestamp in intervals]

        return {k: [(t, p.value) for t, p in v] for k, v in responses.iteritems()}

    def get_distinct_counts_totals(self, model, keys, start, end, rollup=None):
        """
        Count distinct items during a time range.
        """
        rollup, intervals = self._get_intervals(start, end, rollup)

        def get_key(key, timestamp):
            return self.make_key(
                model,
                self.normalize_ts_to_rollup(timestamp, rollup),
                self.get_model_key(key),
            )

        responses = {}
        with self.cluster.fanout() as client:
            for key in keys:
                make_key = functools.partial(get_key, key)
                responses[key] = client.target_key(key).execute_command(
                    'pfcount',
                    *map(make_key, intervals)
                )

        return {k: v.value for k, v in responses.iteritems()}
