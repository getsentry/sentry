from __future__ import absolute_import

import itertools
import logging
import operator
import random
import uuid
from collections import defaultdict, namedtuple
from hashlib import md5

import six
from django.utils import timezone
from django.utils.encoding import force_bytes
from pkg_resources import resource_string

from sentry.tsdb.base import BaseTSDB
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.redis import check_cluster_versions, get_cluster_from_options, SentryScript
from sentry.utils.versioning import Version
from six.moves import reduce
from sentry.utils.compat import map, zip, crc32

logger = logging.getLogger(__name__)

SketchParameters = namedtuple("SketchParameters", "depth width capacity")

CountMinScript = SentryScript(None, resource_string("sentry", "scripts/tsdb/cmsketch.lua"))


class SuppressionWrapper(object):
    """\
    Wraps a context manager and prevents any exceptions raised either during
    the managed block or the exiting of the wrapped manager from propagating.

    You probably shouldn't use this.
    """

    def __init__(self, wrapped):
        self.wrapped = wrapped

    def __enter__(self):
        return self.wrapped.__enter__()

    def __exit__(self, *args):
        try:
            # allow the wrapped manager to perform any cleanup tasks regardless
            # of whether or not we are suppressing an exception raised within
            # the managed block
            self.wrapped.__exit__(*args)
        except Exception:
            pass

        return True


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

    def __init__(self, prefix="ts:", vnodes=64, **options):
        self.cluster, options = get_cluster_from_options("SENTRY_TSDB_OPTIONS", options)
        self.prefix = prefix
        self.vnodes = vnodes
        self.enable_frequency_sketches = options.pop("enable_frequency_sketches", False)
        super(RedisTSDB, self).__init__(**options)

    def validate(self):
        logger.debug("Validating Redis version...")
        version = Version((2, 8, 18)) if self.enable_frequency_sketches else Version((2, 8, 9))
        check_cluster_versions(self.cluster, version, recommended=Version((2, 8, 18)), label="TSDB")

    def get_cluster(self, environment_id):
        """\
        Returns a 2-tuple of the form ``(cluster, durable)``.

        When a cluster is marked as "durable", any exception raised while
        attempting to write data to the cluster is propagated. When the cluster
        is *not* marked as "durable", exceptions raised while attempting to
        write data to the cluster are *not* propagated. This flag does not have
        an effect on read operations.
        """
        return self.cluster, True

    def get_cluster_groups(self, environment_ids):
        results = defaultdict(list)
        for environment_id in environment_ids:
            results[self.get_cluster(environment_id)].append(environment_id)
        return list(results.items())

    def add_environment_parameter(self, key, environment_id):
        if environment_id is not None:
            return u"{}?e={}".format(key, environment_id)
        else:
            return key

    def make_key(self, model, rollup, timestamp, key, environment_id):
        """
        Make a key that is used for distinct counter and frequency table
        values.
        """
        return self.add_environment_parameter(
            u"{prefix}{model}:{epoch}:{key}".format(
                prefix=self.prefix,
                model=model.value,
                epoch=self.normalize_ts_to_rollup(timestamp, rollup),
                key=self.get_model_key(key),
            ),
            environment_id,
        )

    def make_counter_key(self, model, rollup, timestamp, key, environment_id):
        """
        Make a key that is used for counter values.

        Returns a 2-tuple that contains the hash key and the hash field.
        """
        model_key = self.get_model_key(key)

        if isinstance(model_key, six.integer_types):
            vnode = model_key % self.vnodes
        else:
            vnode = crc32(force_bytes(model_key)) % self.vnodes

        return (
            u"{prefix}{model}:{epoch}:{vnode}".format(
                prefix=self.prefix,
                model=model.value,
                epoch=self.normalize_to_rollup(timestamp, rollup),
                vnode=vnode,
            ),
            self.add_environment_parameter(model_key, environment_id),
        )

    def get_model_key(self, key):
        # We specialize integers so that a pure int-map can be optimized by
        # Redis, whereas long strings (say tag values) will store in a more
        # efficient hashed format.
        if not isinstance(key, six.integer_types):
            # enforce utf-8 encoding
            if isinstance(key, six.text_type):
                key = key.encode("utf-8")

            key_repr = repr(key)
            if six.PY3:
                # TODO(python3): Once we're fully on py3, we can remove the condition
                # here and make this the default behaviour.
                # XXX: Python 3 reprs bytes differently to Python 2. In py2,
                # `repr("foo")` would produce a bytestring like `"'foo'"`. In Python 3,
                # we'll end up with a unicode string like `"b'foo'"`. To keep this
                # compatible between versions, we strip off the `b` from the beginning
                # of the string and then encode back to bytes so that md5 can hash the
                # value.
                key_repr = key_repr[1:].encode("utf-8")

            return md5(key_repr).hexdigest()

        return key

    def incr(self, model, key, timestamp=None, count=1, environment_id=None):
        self.validate_arguments([model], [environment_id])

        self.incr_multi([(model, key)], timestamp, count, environment_id)

    def incr_multi(self, items, timestamp=None, count=1, environment_id=None):
        """
        Increment project ID=1 and group ID=5:

        >>> incr_multi([(TimeSeriesModel.project, 1), (TimeSeriesModel.group, 5)])

        Increment individual timestamps:

        >>> incr_multi([(TimeSeriesModel.project, 1, {"timestamp": ...}),
        ...             (TimeSeriesModel.group, 5, {"timestamp": ...})])
        """

        default_timestamp = timestamp
        default_count = count

        self.validate_arguments([item[0] for item in items], [environment_id])

        if default_timestamp is None:
            default_timestamp = timezone.now()

        for (cluster, durable), environment_ids in self.get_cluster_groups(
            set([None, environment_id])
        ):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                # (hash_key, hash_field) -> count
                key_operations = defaultdict(lambda: 0)
                # (hash_key) -> "max expiration encountered"
                key_expiries = defaultdict(lambda: 0.0)

                for rollup, max_values in six.iteritems(self.rollups):
                    for item in items:
                        if len(item) == 2:
                            model, key = item
                            options = {}
                        else:
                            model, key, options = item

                        count = options.get("count", default_count)
                        timestamp = options.get("timestamp", default_timestamp)

                        expiry = self.calculate_expiry(rollup, max_values, timestamp)

                        for environment_id in environment_ids:
                            hash_key, hash_field = self.make_counter_key(
                                model, rollup, timestamp, key, environment_id
                            )

                            if key_expiries[hash_key] < expiry:
                                key_expiries[hash_key] = expiry

                            key_operations[(hash_key, hash_field)] += count

                for (hash_key, hash_field), count in six.iteritems(key_operations):
                    client.hincrby(hash_key, hash_field, count)
                    if key_expiries.get(hash_key):
                        client.expireat(hash_key, key_expiries.pop(hash_key))

    def get_range(self, model, keys, start, end, rollup=None, environment_ids=None):
        """
        To get a range of data for group ID=[1, 2, 3]:

        >>> now = timezone.now()
        >>> get_keys(TimeSeriesModel.group, [1, 2, 3],
        >>>          start=now - timedelta(days=1),
        >>>          end=now)
        """
        # redis backend doesn't support multiple envs
        if environment_ids is not None and len(environment_ids) > 1:
            raise NotImplementedError
        environment_id = environment_ids[0] if environment_ids else None

        self.validate_arguments([model], [environment_id])

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)
        series = map(to_datetime, series)

        results = []
        cluster, _ = self.get_cluster(environment_id)
        with cluster.map() as client:
            for key in keys:
                for timestamp in series:
                    hash_key, hash_field = self.make_counter_key(
                        model, rollup, timestamp, key, environment_id
                    )
                    results.append(
                        (to_timestamp(timestamp), key, client.hget(hash_key, hash_field))
                    )

        results_by_key = defaultdict(dict)
        for epoch, key, count in results:
            results_by_key[key][epoch] = int(count.value or 0)

        for key, points in six.iteritems(results_by_key):
            results_by_key[key] = sorted(points.items())
        return dict(results_by_key)

    def merge(self, model, destination, sources, timestamp=None, environment_ids=None):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )

        self.validate_arguments([model], environment_ids)

        rollups = self.get_active_series(timestamp=timestamp)

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                data = {}
                for rollup, series in rollups.items():
                    data[rollup] = {}
                    for timestamp in series:
                        results = data[rollup][timestamp] = defaultdict(list)
                        for source in sources:
                            for environment_id in environment_ids:
                                source_hash_key, source_hash_field = self.make_counter_key(
                                    model, rollup, timestamp, source, environment_id
                                )
                                results[environment_id].append(
                                    client.hget(source_hash_key, source_hash_field)
                                )
                                client.hdel(source_hash_key, source_hash_field)

            with cluster.map() as client:
                for rollup, series in data.items():
                    for timestamp, results in series.items():
                        for environment_id, promises in results.items():
                            total = sum([int(p.value) for p in promises if p.value])
                            if total:
                                (
                                    destination_hash_key,
                                    destination_hash_field,
                                ) = self.make_counter_key(
                                    model, rollup, timestamp, destination, environment_id
                                )
                                client.hincrby(destination_hash_key, destination_hash_field, total)
                                client.expireat(
                                    destination_hash_key,
                                    self.calculate_expiry(rollup, self.rollups[rollup], timestamp),
                                )

    def delete(self, models, keys, start=None, end=None, timestamp=None, environment_ids=None):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )

        self.validate_arguments(models, environment_ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for timestamp in series:
                        for model in models:
                            for key in keys:
                                for environment_id in environment_ids:
                                    hash_key, hash_field = self.make_counter_key(
                                        model, rollup, timestamp, key, environment_id
                                    )

                                    client.hdel(hash_key, hash_field)

    def record(self, model, key, values, timestamp=None, environment_id=None):
        self.validate_arguments([model], [environment_id])

        self.record_multi(((model, key, values),), timestamp, environment_id)

    def record_multi(self, items, timestamp=None, environment_id=None):
        """
        Record an occurrence of an item in a distinct counter.
        """
        self.validate_arguments([model for model, key, values in items], [environment_id])

        if timestamp is None:
            timestamp = timezone.now()

        ts = int(to_timestamp(timestamp))  # ``timestamp`` is not actually a timestamp :(

        for (cluster, durable), environment_ids in self.get_cluster_groups(
            set([None, environment_id])
        ):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for model, key, values in items:
                    c = client.target_key(key)
                    for rollup, max_values in six.iteritems(self.rollups):
                        for environment_id in environment_ids:
                            k = self.make_key(model, rollup, ts, key, environment_id)
                            c.pfadd(k, *values)
                            c.expireat(k, self.calculate_expiry(rollup, max_values, timestamp))

    def get_distinct_counts_series(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        self.validate_arguments([model], [environment_id])

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        responses = {}
        cluster, _ = self.get_cluster(environment_id)
        with cluster.fanout() as client:
            for key in keys:
                c = client.target_key(key)
                r = responses[key] = []
                for timestamp in series:
                    r.append(
                        (
                            timestamp,
                            c.pfcount(self.make_key(model, rollup, timestamp, key, environment_id)),
                        )
                    )

        return {
            key: [(timestamp, promise.value) for timestamp, promise in value]
            for key, value in six.iteritems(responses)
        }

    def get_distinct_counts_totals(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        """
        Count distinct items during a time range.
        """
        self.validate_arguments([model], [environment_id])

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        responses = {}
        cluster, _ = self.get_cluster(environment_id)
        with cluster.fanout() as client:
            for key in keys:
                # XXX: The current versions of the Redis driver don't implement
                # ``PFCOUNT`` correctly (although this is fixed in the Git
                # master, so should be available in the next release) and only
                # supports a single key argument -- not the variadic signature
                # supported by the protocol -- so we have to call the command
                # directly here instead.
                ks = []
                for timestamp in series:
                    ks.append(self.make_key(model, rollup, timestamp, key, environment_id))

                responses[key] = client.target_key(key).execute_command("PFCOUNT", *ks)

        return {key: value.value for key, value in six.iteritems(responses)}

    def get_distinct_counts_union(
        self, model, keys, start, end=None, rollup=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])

        if not keys:
            return 0

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        temporary_id = uuid.uuid1().hex

        def make_temporary_key(key):
            return u"{}{}:{}".format(self.prefix, temporary_id, key)

        def expand_key(key):
            """
            Return a list containing all keys for each interval in the series for a key.
            """
            return [
                self.make_key(model, rollup, timestamp, key, environment_id) for timestamp in series
            ]

        cluster, _ = self.get_cluster(environment_id)
        router = cluster.get_router()

        def map_key_to_host(hosts, key):
            """
            Identify the host where a key is located and add it to the host map.
            """
            hosts[router.get_host_for_key(key)].add(key)
            return hosts

        def get_partition_aggregate(value):
            """
            Fetch the HyperLogLog value (in its raw byte representation) that
            results from merging all HyperLogLogs at the provided keys.
            """
            (host, keys) = value
            destination = make_temporary_key(u"p:{}".format(host))
            client = cluster.get_local_client(host)
            with client.pipeline(transaction=False) as pipeline:
                pipeline.execute_command(
                    "PFMERGE", destination, *itertools.chain.from_iterable(map(expand_key, keys))
                )
                pipeline.get(destination)
                pipeline.delete(destination)
                return (host, pipeline.execute()[1])

        def merge_aggregates(values):
            """
            Calculate the cardinality of the provided HyperLogLog values.
            """
            destination = make_temporary_key("a")  # all values will be merged into this key
            aggregates = {make_temporary_key(u"a:{}".format(host)): value for host, value in values}

            # Choose a random host to execute the reduction on. (We use a host
            # here that we've already accessed as part of this process -- this
            # way, we constrain the choices to only hosts that we know are
            # running.)
            client = cluster.get_local_client(random.choice(values)[0])
            with client.pipeline(transaction=False) as pipeline:
                pipeline.mset(aggregates)
                pipeline.execute_command("PFMERGE", destination, *aggregates.keys())
                pipeline.execute_command("PFCOUNT", destination)
                pipeline.delete(destination, *aggregates.keys())
                return pipeline.execute()[2]

        # TODO: This could be optimized to skip the intermediate step for the
        # host that has the largest number of keys if the final merge and count
        # is performed on that host. If that host contains *all* keys, the
        # final reduction could be performed as a single PFCOUNT, skipping the
        # MSET and PFMERGE operations entirely.

        return merge_aggregates(
            [
                get_partition_aggregate(x)
                for x in reduce(map_key_to_host, keys, defaultdict(set)).items()
            ]
        )

    def merge_distinct_counts(
        self, model, destination, sources, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )

        self.validate_arguments([model], environment_ids)

        rollups = self.get_active_series(timestamp=timestamp)

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            wrapper = SuppressionWrapper if not durable else lambda value: value

            temporary_id = uuid.uuid1().hex

            def make_temporary_key(key):
                return u"{}{}:{}".format(self.prefix, temporary_id, key)

            data = {}
            for rollup, series in rollups.items():
                data[rollup] = {timestamp: {e: [] for e in environment_ids} for timestamp in series}

            with wrapper(cluster.fanout()) as client:
                for source in sources:
                    c = client.target_key(source)
                    for rollup, series in data.items():
                        for timestamp, results in series.items():
                            for environment_id in environment_ids:
                                key = self.make_key(
                                    model, rollup, to_timestamp(timestamp), source, environment_id
                                )
                                results[environment_id].append(c.get(key))
                                c.delete(key)

            with wrapper(cluster.fanout()) as client:
                c = client.target_key(destination)

                temporary_key_sequence = itertools.count()

                for rollup, series in data.items():
                    for timestamp, results in series.items():
                        for environment_id, promises in results.items():
                            values = {}
                            for promise in promises:
                                if promise.value is None:
                                    continue
                                k = make_temporary_key(next(temporary_key_sequence))
                                values[k] = promise.value

                            if values:
                                key = self.make_key(
                                    model,
                                    rollup,
                                    to_timestamp(timestamp),
                                    destination,
                                    environment_id,
                                )
                                c.mset(values)
                                c.pfmerge(key, key, *values.keys())
                                c.delete(*values.keys())
                                c.expireat(
                                    key,
                                    self.calculate_expiry(rollup, self.rollups[rollup], timestamp),
                                )

    def delete_distinct_counts(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )

        self.validate_arguments(models, environment_ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for timestamp in series:
                        for model in models:
                            for key in keys:
                                c = client.target_key(key)
                                for environment_id in environment_ids:
                                    c.delete(
                                        self.make_key(
                                            model,
                                            rollup,
                                            to_timestamp(timestamp),
                                            key,
                                            environment_id,
                                        )
                                    )

    def make_frequency_table_keys(self, model, rollup, timestamp, key, environment_id):
        prefix = self.make_key(model, rollup, timestamp, key, environment_id)
        return map(operator.methodcaller("format", prefix), ("{}:i", "{}:e"))

    def record_frequency_multi(self, requests, timestamp=None, environment_id=None):
        self.validate_arguments([model for model, request in requests], [environment_id])

        if not self.enable_frequency_sketches:
            return

        if timestamp is None:
            timestamp = timezone.now()

        ts = int(to_timestamp(timestamp))  # ``timestamp`` is not actually a timestamp :(

        for (cluster, durable), environment_ids in self.get_cluster_groups(
            set([None, environment_id])
        ):
            commands = {}

            for model, request in requests:
                for key, items in six.iteritems(request):
                    keys = []
                    expirations = {}

                    # Figure out all of the keys we need to be incrementing, as
                    # well as their expiration policies.
                    for rollup, max_values in six.iteritems(self.rollups):
                        for environment_id in environment_ids:
                            chunk = self.make_frequency_table_keys(
                                model, rollup, ts, key, environment_id
                            )
                            keys.extend(chunk)

                        expiry = self.calculate_expiry(rollup, max_values, timestamp)
                        for k in chunk:
                            expirations[k] = expiry

                    arguments = ["INCR"] + list(self.DEFAULT_SKETCH_PARAMETERS)
                    for member, score in items.items():
                        arguments.extend((score, member))

                    # Since we're essentially merging dictionaries, we need to
                    # append this to any value that already exists at the key.
                    cmds = commands.setdefault(key, [])
                    cmds.append((CountMinScript, keys, arguments))
                    for k, t in expirations.items():
                        cmds.append(("EXPIREAT", k, t))

            try:
                cluster.execute_commands(commands)
            except Exception:
                if durable:
                    raise

    def get_most_frequent(
        self, model, keys, start, end=None, rollup=None, limit=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])

        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        arguments = ["RANKED"] + list(self.DEFAULT_SKETCH_PARAMETERS)
        if limit is not None:
            arguments.append(int(limit))

        commands = {}
        for key in keys:
            ks = []
            for timestamp in series:
                ks.extend(
                    self.make_frequency_table_keys(model, rollup, timestamp, key, environment_id)
                )
            commands[key] = [(CountMinScript, ks, arguments)]

        results = {}
        cluster, _ = self.get_cluster(environment_id)
        for key, responses in cluster.execute_commands(commands).items():
            results[key] = [
                (member.decode("utf-8"), float(score)) for member, score in responses[0].value
            ]

        return results

    def get_most_frequent_series(
        self, model, keys, start, end=None, rollup=None, limit=None, environment_id=None
    ):
        self.validate_arguments([model], [environment_id])

        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        arguments = ["RANKED"] + list(self.DEFAULT_SKETCH_PARAMETERS)
        if limit is not None:
            arguments.append(int(limit))

        commands = {}
        for key in keys:
            commands[key] = [
                (
                    CountMinScript,
                    self.make_frequency_table_keys(model, rollup, timestamp, key, environment_id),
                    arguments,
                )
                for timestamp in series
            ]

        def unpack_response(response):
            return {item.decode("utf-8"): float(score) for item, score in response.value}

        results = {}
        cluster, _ = self.get_cluster(environment_id)
        for key, responses in cluster.execute_commands(commands).items():
            results[key] = zip(series, map(unpack_response, responses))

        return results

    def get_frequency_series(self, model, items, start, end=None, rollup=None, environment_id=None):
        self.validate_arguments([model], [environment_id])

        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        # Here we freeze ordering of the members, since we'll be passing these
        # as positional arguments to the Redis script and later associating the
        # results (which are returned in the same order that the arguments were
        # provided) with the original input values to compose the result.
        for key, members in items.items():
            items[key] = list(members)

        commands = {}

        arguments = ["ESTIMATE"] + list(self.DEFAULT_SKETCH_PARAMETERS)
        for key, members in items.items():
            ks = []
            for timestamp in series:
                ks.extend(
                    self.make_frequency_table_keys(model, rollup, timestamp, key, environment_id)
                )

            commands[key] = [(CountMinScript, ks, arguments + members)]

        results = {}

        cluster, _ = self.get_cluster(environment_id)
        for key, responses in cluster.execute_commands(commands).items():
            members = items[key]

            chunk = results[key] = []
            for timestamp, scores in zip(series, responses[0].value):
                chunk.append((timestamp, dict(zip(members, map(float, scores)))))

        return results

    def get_frequency_totals(self, model, items, start, end=None, rollup=None, environment_id=None):
        self.validate_arguments([model], [environment_id])

        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        responses = {}

        for key, series in six.iteritems(
            self.get_frequency_series(model, items, start, end, rollup, environment_id)
        ):
            response = responses[key] = {}
            for timestamp, results in series:
                for member, value in results.items():
                    response[member] = response.get(member, 0.0) + value

        return responses

    def merge_frequencies(self, model, destination, sources, timestamp=None, environment_ids=None):
        environment_ids = list(
            (set(environment_ids) if environment_ids is not None else set()).union([None])
        )

        self.validate_arguments([model], environment_ids)

        if not self.enable_frequency_sketches:
            return

        rollups = []
        for rollup, samples in self.rollups.items():
            _, series = self.get_optimal_rollup_series(
                to_datetime(self.get_earliest_timestamp(rollup, timestamp=timestamp)),
                end=None,
                rollup=rollup,
            )
            rollups.append((rollup, map(to_datetime, series)))

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            exports = defaultdict(list)

            for source in sources:
                for rollup, series in rollups:
                    for timestamp in series:
                        keys = []
                        for environment_id in environment_ids:
                            keys.extend(
                                self.make_frequency_table_keys(
                                    model, rollup, to_timestamp(timestamp), source, environment_id
                                )
                            )
                        arguments = ["EXPORT"] + list(self.DEFAULT_SKETCH_PARAMETERS)
                        exports[source].extend([(CountMinScript, keys, arguments), ["DEL"] + keys])

            try:
                responses = cluster.execute_commands(exports)
            except Exception:
                if durable:
                    raise
                else:
                    continue

            imports = []

            for source, results in responses.items():
                results = iter(results)
                for rollup, series in rollups:
                    for timestamp in series:
                        for environment_id, payload in zip(environment_ids, next(results).value):
                            imports.append(
                                (
                                    CountMinScript,
                                    self.make_frequency_table_keys(
                                        model,
                                        rollup,
                                        to_timestamp(timestamp),
                                        destination,
                                        environment_id,
                                    ),
                                    ["IMPORT"] + list(self.DEFAULT_SKETCH_PARAMETERS) + [payload],
                                )
                            )
                        next(results)  # pop off the result of DEL

            try:
                cluster.execute_commands({destination: imports})
            except Exception:
                if durable:
                    raise

    def delete_frequencies(
        self, models, keys, start=None, end=None, timestamp=None, environment_ids=None
    ):
        environment_ids = (set(environment_ids) if environment_ids is not None else set()).union(
            [None]
        )

        self.validate_arguments(models, environment_ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), environment_ids in self.get_cluster_groups(environment_ids):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for timestamp in series:
                        for model in models:
                            for key in keys:
                                c = client.target_key(key)
                                for environment_id in environment_ids:
                                    for k in self.make_frequency_table_keys(
                                        model, rollup, to_timestamp(timestamp), key, environment_id
                                    ):
                                        c.delete(k)
