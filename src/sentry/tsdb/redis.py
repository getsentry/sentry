"""
sentry.tsdb.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import logging
import operator
from binascii import crc32
from collections import defaultdict, namedtuple
from datetime import timedelta
from hashlib import md5

import six
from django.utils import timezone
from pkg_resources import resource_string
from redis.client import Script

from sentry.tsdb.base import BaseTSDB
from sentry.utils.dates import to_timestamp
from sentry.utils.redis import check_cluster_versions, get_cluster_from_options
from sentry.utils.versioning import Version

logger = logging.getLogger(__name__)


SketchParameters = namedtuple('SketchParameters', 'depth width capacity')


CountMinScript = Script(
    None,
    resource_string('sentry', 'scripts/tsdb/cmsketch.lua'),
)


class RedisTSDB(BaseTSDB):
    """
    A time series storage backend for Redis.

    The time series API supports three data types:

        * simple counters
        * distinct counters (number of unique elements seen)
        * frequency tables (a set of items ranked by most frequently observed)

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

    Frequency tables are modeled using two data structures:

        * top-N index: a sorted set containing the most frequently observed items,
        * estimation matrix: a hash table containing counters, used in a Count-Min sketch

    Member scores are 100% accurate until the index is filled (and no memory is
    used for the estimation matrix until this point), after which the data
    structure switches to a probabilistic implementation and accuracy begins to
    degrade for less frequently observed items, but remains accurate for more
    frequently observed items.

    Frequency tables are especially useful when paired with a (non-distinct)
    counter of the total number of observations so that scores of items of the
    frequency table can be displayed as percentages of the whole data set.
    (Additional documentation and the bulk of the logic for implementing the
    frequency table API can be found in the ``cmsketch.lua`` script.)
    """
    DEFAULT_SKETCH_PARAMETERS = SketchParameters(3, 128, 50)

    def __init__(self, prefix='ts:', vnodes=64, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_TSDB_OPTIONS', options)
        self.prefix = prefix
        self.vnodes = vnodes
        self.enable_frequency_sketches = options.pop('enable_frequency_sketches', False)
        super(RedisTSDB, self).__init__(**options)

    def validate(self):
        logger.debug('Validating Redis version...')
        version = Version((2, 8, 18)) if self.enable_frequency_sketches else Version((2, 8, 9))
        check_cluster_versions(
            self.cluster,
            version,
            label='TSDB',
        )

    def make_key(self, model, rollup, timestamp, key):
        """
        Make a key that is used for distinct counter and frequency table
        values.
        """
        return '{prefix}{model}:{epoch}:{key}'.format(
            prefix=self.prefix,
            model=model.value,
            epoch=self.normalize_ts_to_rollup(timestamp, rollup),
            key=self.get_model_key(key),
        )

    def make_counter_key(self, model, epoch, model_key):
        """
        Make a key that is used for counter values.
        """
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
        make_key = self.make_counter_key
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
        make_key = self.make_counter_key

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

        ts = int(to_timestamp(timestamp))  # ``timestamp`` is not actually a timestamp :(

        with self.cluster.fanout() as client:
            for model, key, values in items:
                c = client.target_key(key)
                for rollup, max_values in self.rollups:
                    k = self.make_key(
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
                            self.make_key(
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
                    ks.append(self.make_key(model, rollup, timestamp, key))

                responses[key] = client.target_key(key).execute_command('PFCOUNT', *ks)

        return {key: value.value for key, value in responses.iteritems()}

    def make_frequency_table_keys(self, model, rollup, timestamp, key):
        prefix = self.make_key(model, rollup, timestamp, key)
        return map(
            operator.methodcaller('format', prefix),
            ('{}:c', '{}:i', '{}:e'),
        )

    def record_frequency_multi(self, requests, timestamp=None):
        if not self.enable_frequency_sketches:
            return

        if timestamp is None:
            timestamp = timezone.now()

        ts = int(to_timestamp(timestamp))  # ``timestamp`` is not actually a timestamp :(

        commands = {}

        for model, request in requests:
            for key, items in request.iteritems():
                keys = []
                expirations = {}

                # Figure out all of the keys we need to be incrementing, as
                # well as their expiration policies.
                for rollup, max_values in self.rollups:
                    chunk = self.make_frequency_table_keys(model, rollup, ts, key)
                    keys.extend(chunk)

                    expiry = self.calculate_expiry(rollup, max_values, timestamp)
                    for k in chunk:
                        expirations[k] = expiry

                arguments = ['INCR'] + list(self.DEFAULT_SKETCH_PARAMETERS)
                for member, score in items.items():
                    arguments.extend((score, member))

                # Since we're essentially merging dictionaries, we need to
                # append this to any value that already exists at the key.
                cmds = commands.setdefault(key, [])
                cmds.append((CountMinScript, keys, arguments))
                for k, t in expirations.items():
                    cmds.append(('EXPIREAT', k, t))

        self.cluster.execute_commands(commands)

    def get_most_frequent(self, model, keys, start, end=None, rollup=None, limit=None):
        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        commands = {}

        arguments = ['RANKED']
        if limit is not None:
            arguments.append(int(limit))

        for key in keys:
            ks = []
            for timestamp in series:
                ks.extend(self.make_frequency_table_keys(model, rollup, timestamp, key))
            commands[key] = [(CountMinScript, ks, arguments)]

        results = {}

        for key, responses in self.cluster.execute_commands(commands).items():
            results[key] = [(member, float(score)) for member, score in responses[0].value]

        return results

    def get_frequency_series(self, model, items, start, end=None, rollup=None):
        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        # Freeze ordering of the members (we'll need these later.)
        for key, members in items.items():
            items[key] = tuple(members)

        commands = {}

        for key, members in items.items():
            ks = []
            for timestamp in series:
                ks.extend(self.make_frequency_table_keys(model, rollup, timestamp, key))

            commands[key] = [(CountMinScript, ks, ('ESTIMATE',) + members)]

        results = {}

        for key, responses in self.cluster.execute_commands(commands).items():
            members = items[key]

            chunk = results[key] = []
            for timestamp, scores in zip(series, responses[0].value):
                chunk.append((timestamp, dict(zip(members, map(float, scores)))))

        return results

    def get_frequency_totals(self, model, items, start, end=None, rollup=None):
        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        responses = {}

        for key, series in self.get_frequency_series(model, items, start, end, rollup).iteritems():
            response = responses[key] = {}
            for timestamp, results in series:
                for member, value in results.items():
                    response[member] = response.get(member, 0.0) + value

        return responses
