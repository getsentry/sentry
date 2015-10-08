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
    A time series storage backend for Redis.

    The time series API supports two data types:

        * simple counters
        * distinct counters (number of unique elements seen)

    The backend also supports virtual nodes (``vnodes``) which controls shard
    distribution. This value should be set to the anticipated maximum number of
    physical hosts and not modified after data has been written.

    Simple counters are stored in hashes. The key of the hash is composed of
    the model, epoch (which defines the start of the rollup period), and a
    shard identifier. This allows TTLs to be applied to the entire bucket,
    instead of having to be stored for every individual element in the rollup
    period. This results in a data layout that looks something like this::

        {
            "<model>:<epoch>:<shard id>": {
                "<key>": value,
                ...
            },
            ...
        }

    Distinct counters are stored using HyperLogLog, which provides a
    cardinality estimate with a standard error of 0.8%. The data layout looks
    something like this::

        {
            "<model>:<epoch>:<shard id>:<key>": value,
            ...
        }

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

    def record(self, model, key, values, timestamp=None):
        self.record_multi(((model, key, values),), timestamp)

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
                    k = self.make_key(
                        model,
                        self.normalize_to_rollup(timestamp, rollup),
                        self.get_model_key(key),
                    )
                    c.pfadd(k, *values)
                    c.expireat(
                        k,
                        self.calculate_expiry(rollup, max_values, timestamp),
                    )

    def get_distinct_counts_series(self, model, keys, start, end=None, rollup=None):
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

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
                responses[key] = [(timestamp, c.pfcount(make_key(timestamp))) for timestamp in series]

        return {k: [(t, p.value) for t, p in v] for k, v in responses.iteritems()}

    def get_distinct_counts_totals(self, model, keys, start, end=None, rollup=None):
        """
        Count distinct items during a time range.
        """
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

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
                # XXX: The current versions of the Redis driver don't implement
                # ``PFCOUNT`` correctly (although this is fixed in the Git
                # master, so should be available in the next release) and only
                # supports a single key argument -- not the variadic signature
                # supported by the protocol -- so we have to call the commnand
                # directly here instead.
                responses[key] = client.target_key(key).execute_command(
                    'pfcount',
                    *map(make_key, series)
                )

        return {k: v.value for k, v in responses.iteritems()}
