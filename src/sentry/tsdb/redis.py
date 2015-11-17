"""
sentry.tsdb.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import logging
import six

from binascii import crc32
from collections import defaultdict
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from hashlib import md5

from sentry.tsdb.base import BaseTSDB
from sentry.utils.dates import to_timestamp
from sentry.utils.redis import (
    check_cluster_versions,
    make_rb_cluster,
)
from sentry.utils.versioning import Version


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
            "<model>:<epoch>:<key>": value,
            ...
        }

    """
    def __init__(self, hosts=None, prefix='ts:', vnodes=64, **kwargs):
        # inherit default options from REDIS_OPTIONS
        defaults = settings.SENTRY_REDIS_OPTIONS

        if hosts is None:
            hosts = defaults.get('hosts', {0: {}})

        self.cluster = make_rb_cluster(hosts)
        self.prefix = prefix
        self.vnodes = vnodes
        super(RedisTSDB, self).__init__(**kwargs)

    def validate(self):
        logger.info('Validating Redis version...')
        check_cluster_versions(
            self.cluster,
            Version((2, 8, 9)),
            label='TSDB',
        )

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

    def make_distinct_counter_key(self, model, rollup, timestamp, key):
        return '{prefix}{model}:{epoch}:{key}'.format(
            prefix=self.prefix,
            model=model.value,
            epoch=self.normalize_ts_to_rollup(timestamp, rollup),
            key=self.get_model_key(key),
        )

    def record(self, model, key, values, timestamp=None):
        self.record_multi(((model, key, values),), timestamp)

    def record_multi(self, items, timestamp=None):
        """
        Record an occurence of an item in a distinct counter.
        """
        if timestamp is None:
            timestamp = timezone.now()

        ts = int(to_timestamp(timestamp))  # ``timestamp`` is not actually a timestamp :(

        with self.cluster.fanout() as client:
            for model, key, values in items:
                c = client.target_key(key)
                for rollup, max_values in self.rollups:
                    k = self.make_distinct_counter_key(
                        model,
                        rollup,
                        ts,
                        key,
                    )
                    c.pfadd(k, *values)
                    c.expireat(
                        k,
                        self.calculate_expiry(
                            rollup,
                            max_values,
                            timestamp,
                        ),
                    )

    def get_distinct_counts_series(self, model, keys, start, end=None, rollup=None):
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        responses = {}
        with self.cluster.fanout() as client:
            for key in keys:
                c = client.target_key(key)
                r = responses[key] = []
                for timestamp in series:
                    r.append((
                        timestamp,
                        c.pfcount(
                            self.make_distinct_counter_key(
                                model,
                                rollup,
                                timestamp,
                                key,
                            ),
                        ),
                    ))

        return {key: [(timestamp, promise.value) for timestamp, promise in value] for key, value in responses.iteritems()}

    def get_distinct_counts_totals(self, model, keys, start, end=None, rollup=None):
        """
        Count distinct items during a time range.
        """
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        responses = {}
        with self.cluster.fanout() as client:
            for key in keys:
                # XXX: The current versions of the Redis driver don't implement
                # ``PFCOUNT`` correctly (although this is fixed in the Git
                # master, so should be available in the next release) and only
                # supports a single key argument -- not the variadic signature
                # supported by the protocol -- so we have to call the commnand
                # directly here instead.
                ks = []
                for timestamp in series:
                    ks.append(self.make_distinct_counter_key(model, rollup, timestamp, key))

                responses[key] = client.target_key(key).execute_command('PFCOUNT', *ks)

        return {key: value.value for key, value in responses.iteritems()}
