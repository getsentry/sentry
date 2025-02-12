import binascii
import itertools
import logging
import uuid
from collections import defaultdict, namedtuple
from collections.abc import Callable, Iterable, Mapping, Sequence
from datetime import datetime
from hashlib import md5
from typing import Any, ContextManager, Generic, TypeVar

import rb
from django.utils import timezone
from django.utils.encoding import force_bytes
from redis.client import Script

from sentry.tsdb.base import BaseTSDB, IncrMultiOptions, TSDBItem, TSDBKey, TSDBModel
from sentry.utils.dates import to_datetime
from sentry.utils.redis import check_cluster_versions, get_cluster_from_options, load_redis_script
from sentry.utils.versioning import Version

logger = logging.getLogger(__name__)

T = TypeVar("T")

SketchParameters = namedtuple("SketchParameters", "depth width capacity")

CountMinScript = load_redis_script("tsdb/cmsketch.lua")


def _crc32(data: bytes) -> int:
    # python 2 equivalent crc32 to return signed
    rv = binascii.crc32(data)
    return rv - ((rv & 0x80000000) << 1)


class SuppressionWrapper(Generic[T]):
    """\
    Wraps a context manager and prevents any exceptions raised either during
    the managed block or the exiting of the wrapped manager from propagating.

    You probably shouldn't use this.
    """

    def __init__(self, wrapped: ContextManager[T]):
        self.wrapped = wrapped

    def __enter__(self) -> T:
        return self.wrapped.__enter__()

    def __exit__(self, *args) -> bool:
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

    def __init__(self, prefix: str = "ts:", vnodes: int = 64, **options: Any):
        cluster, options = get_cluster_from_options("SENTRY_TSDB_OPTIONS", options)
        self.cluster = cluster
        self.prefix = prefix
        self.vnodes = vnodes
        self.enable_frequency_sketches = options.pop("enable_frequency_sketches", False)
        super().__init__(**options)

    def validate(self) -> None:
        logger.debug("Validating Redis version...")
        version = Version((2, 8, 18)) if self.enable_frequency_sketches else Version((2, 8, 9))
        check_cluster_versions(self.cluster, version, recommended=Version((2, 8, 18)), label="TSDB")

    def get_cluster(self, environment_id: int | None) -> tuple[rb.Cluster, bool]:
        """\
        Returns a 2-tuple of the form ``(cluster, durable)``.

        When a cluster is marked as "durable", any exception raised while
        attempting to write data to the cluster is propagated. When the cluster
        is *not* marked as "durable", exceptions raised while attempting to
        write data to the cluster are *not* propagated. This flag does not have
        an effect on read operations.
        """
        return self.cluster, True

    def get_cluster_groups(
        self, environment_ids: Iterable[int | None]
    ) -> list[tuple[tuple[rb.Cluster, bool], list[int | None]]]:
        results: dict[tuple[rb.Cluster, bool], list[int | None]] = defaultdict(list)
        for environment_id in environment_ids:
            results[self.get_cluster(environment_id)].append(environment_id)
        return list(results.items())

    def add_environment_parameter(self, key: str | int, environment_id: int | None) -> str | int:
        if environment_id is not None:
            return f"{key}?e={environment_id}"
        else:
            return key

    def make_key(
        self,
        model: TSDBModel,
        rollup: int,
        timestamp: float,
        key: int | str,
        environment_id: int | None,
    ) -> str | int:
        """
        Make a key that is used for distinct counter and frequency table
        values.
        """
        return self.add_environment_parameter(
            "{prefix}{model}:{epoch}:{key}".format(
                prefix=self.prefix,
                model=model.value,
                epoch=self.normalize_ts_to_rollup(timestamp, rollup),
                key=self.get_model_key(key),
            ),
            environment_id,
        )

    def make_counter_key(
        self,
        model: TSDBModel,
        rollup: int,
        timestamp: float | datetime,
        key: int | str | bytes,
        environment_id: int | None,
    ) -> tuple[str, str | int]:
        """
        Make a key that is used for counter values.

        Returns a 2-tuple that contains the hash key and the hash field.
        """
        model_key = self.get_model_key(key)

        if isinstance(model_key, int):
            vnode = model_key % self.vnodes
        else:
            vnode = _crc32(force_bytes(model_key)) % self.vnodes

        return (
            "{prefix}{model}:{epoch}:{vnode}".format(
                prefix=self.prefix,
                model=model.value,
                epoch=self.normalize_to_rollup(timestamp, rollup),
                vnode=vnode,
            ),
            self.add_environment_parameter(model_key, environment_id),
        )

    def get_model_key(self, key: int | str | bytes) -> int | str:
        # We specialize integers so that a pure int-map can be optimized by
        # Redis, whereas long strings (say tag values) will store in a more
        # efficient hashed format.
        if not isinstance(key, int):
            # enforce utf-8 encoding
            if isinstance(key, str):
                key = key.encode("utf-8")

            key_repr = repr(key)[1:].encode("utf-8")

            return md5(key_repr).hexdigest()

        return key

    def incr(
        self,
        model: TSDBModel,
        key: TSDBKey,
        timestamp: datetime | None = None,
        count: int = 1,
        environment_id: int | None = None,
    ) -> None:
        self.validate_arguments([model], [environment_id])

        self.incr_multi([(model, key)], timestamp, count, environment_id)

    def incr_multi(
        self,
        items: Sequence[tuple[TSDBModel, TSDBKey] | tuple[TSDBModel, TSDBKey, IncrMultiOptions]],
        timestamp: datetime | None = None,
        count: int = 1,
        environment_id: int | None = None,
    ) -> None:
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

        for (cluster, durable), environment_ids in self.get_cluster_groups({None, environment_id}):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                # (hash_key, hash_field) -> count
                key_operations: dict[tuple[str, str | int], int] = defaultdict(int)
                # (hash_key) -> "max expiration encountered"
                key_expiries: dict[str, float] = defaultdict(float)

                for rollup, max_values in self.rollups.items():
                    for item in items:
                        if len(item) == 2:
                            model, key = item
                            options: IncrMultiOptions = {
                                "timestamp": default_timestamp,
                                "count": default_count,
                            }
                        else:
                            model, key, options = item

                        count = options.get("count", default_count)
                        _timestamp = options.get("timestamp", default_timestamp)

                        expiry = self.calculate_expiry(rollup, max_values, _timestamp)

                        for _environment_id in environment_ids:
                            hash_key, hash_field = self.make_counter_key(
                                model, rollup, _timestamp, key, _environment_id
                            )

                            if key_expiries[hash_key] < expiry:
                                key_expiries[hash_key] = expiry

                            key_operations[(hash_key, hash_field)] += count

                for (hash_key, hash_field), count in key_operations.items():
                    client.hincrby(hash_key, hash_field, count)
                    if key_expiries.get(hash_key):
                        client.expireat(hash_key, key_expiries.pop(hash_key))

    def get_range(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        conditions=None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ) -> dict[TSDBKey, list[tuple[int, int]]]:
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
        _series = [to_datetime(item) for item in series]

        results = []
        cluster, _ = self.get_cluster(environment_id)
        with cluster.map() as client:
            for key in keys:
                for timestamp in _series:
                    hash_key, hash_field = self.make_counter_key(
                        model, rollup, timestamp, key, environment_id
                    )
                    results.append(
                        (int(timestamp.timestamp()), key, client.hget(hash_key, hash_field))
                    )

        results_by_key: dict[TSDBKey, dict[int, int]] = defaultdict(dict)
        for epoch, key, count in results:
            results_by_key[key][epoch] = int(count.value or 0)

        output = {}
        for key, points in results_by_key.items():
            output[key] = sorted(points.items())
        return output

    def merge(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments([model], ids)

        rollups = self.get_active_series(timestamp=timestamp)

        for (cluster, durable), _environment_ids in self.get_cluster_groups(ids):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                data: dict[int, dict[datetime, dict[int | None, list[rb.Promise]]]] = {}
                for rollup, series in rollups.items():
                    data[rollup] = {}
                    for _timestamp in series:
                        results = data[rollup][_timestamp] = defaultdict(list)
                        for source in sources:
                            for environment_id in _environment_ids:
                                source_hash_key, source_hash_field = self.make_counter_key(
                                    model, rollup, _timestamp, source, environment_id
                                )
                                results[environment_id].append(
                                    client.hget(source_hash_key, source_hash_field)
                                )
                                client.hdel(source_hash_key, source_hash_field)

            with cluster.map() as client:
                for rollup, _series in data.items():
                    for _timestamp, _results in _series.items():
                        for environment_id, promises in _results.items():
                            total = sum(int(p.value) for p in promises if p.value)
                            if total:
                                (
                                    destination_hash_key,
                                    destination_hash_field,
                                ) = self.make_counter_key(
                                    model, rollup, _timestamp, destination, environment_id
                                )
                                client.hincrby(destination_hash_key, destination_hash_field, total)
                                client.expireat(
                                    destination_hash_key,
                                    self.calculate_expiry(rollup, self.rollups[rollup], _timestamp),
                                )

    def delete(
        self,
        models: list[Any],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int | None] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments(models, ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), _ids in self.get_cluster_groups(ids):
            manager = cluster.map()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for _timestamp in series:
                        for model in models:
                            for key in keys:
                                for environment_id in _ids:
                                    hash_key, hash_field = self.make_counter_key(
                                        model, rollup, _timestamp, key, environment_id
                                    )

                                    client.hdel(hash_key, hash_field)

    def record(
        self,
        model: TSDBModel,
        key: int,
        values: Iterable[str],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        self.validate_arguments([model], [environment_id])

        self.record_multi(((model, key, values),), timestamp, environment_id)

    def record_multi(
        self,
        items: Iterable[tuple[TSDBModel, int, Iterable[str]]],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        """
        Record an occurrence of an item in a distinct counter.
        """
        self.validate_arguments([model for model, key, values in items], [environment_id])

        if timestamp is None:
            timestamp = timezone.now()

        ts = int(timestamp.timestamp())  # ``timestamp`` is not actually a timestamp :(

        for (cluster, durable), environment_ids in self.get_cluster_groups({None, environment_id}):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for model, key, values in items:
                    c = client.target_key(key)
                    for rollup, max_values in self.rollups.items():
                        for _environment_id in environment_ids:
                            k = self.make_key(model, rollup, ts, key, _environment_id)
                            c.pfadd(k, *values)
                            c.expireat(k, self.calculate_expiry(rollup, max_values, timestamp))

    def get_distinct_counts_series(
        self,
        model: TSDBModel,
        keys: Sequence[int],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[int, list[tuple[int, Any]]]:
        """
        Fetch counts of distinct items for each rollup interval within the range.
        """
        self.validate_arguments([model], [environment_id])

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        responses: dict[int, list[tuple[int, Any]]] = {}
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
            for key, value in responses.items()
        }

    def get_distinct_counts_totals(
        self,
        model: TSDBModel,
        keys: Sequence[int],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, int | str] | None = None,
        referrer_suffix: str | None = None,
        conditions: list[tuple[str, str, str]] | None = None,
    ) -> dict[int, Any]:
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

        return {key: value.value for key, value in responses.items()}

    def merge_distinct_counts(
        self,
        model: TSDBModel,
        destination: int,
        sources: list[int],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments([model], ids)

        rollups = self.get_active_series(timestamp=timestamp)

        for (cluster, durable), _ids in self.get_cluster_groups(ids):
            wrapper: Callable[[ContextManager[T]], ContextManager[T]]
            if not durable:
                wrapper = SuppressionWrapper
            else:
                wrapper = lambda value: value

            temporary_id = uuid.uuid1().hex

            def make_temporary_key(key: str | int) -> str:
                return f"{self.prefix}{temporary_id}:{key}"

            data: dict[int, dict[datetime, dict[int | None, list[rb.Promise]]]] = {}
            for rollup, rollup_series in rollups.items():
                data[rollup] = {_timestamp: {e: [] for e in _ids} for _timestamp in rollup_series}

            with wrapper(cluster.fanout()) as client:
                for source in sources:
                    c = client.target_key(source)
                    for rollup, series in data.items():
                        for _timestamp, results in series.items():
                            for environment_id in _ids:
                                key = self.make_key(
                                    model, rollup, _timestamp.timestamp(), source, environment_id
                                )
                                results[environment_id].append(c.get(key))
                                c.delete(key)

            with wrapper(cluster.fanout()) as client:
                c = client.target_key(destination)

                temporary_key_sequence = itertools.count()

                for rollup, _series in data.items():
                    for _timestamp, results in _series.items():
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
                                    _timestamp.timestamp(),
                                    destination,
                                    environment_id,
                                )
                                c.mset(values)
                                c.pfmerge(key, key, *values.keys())
                                c.delete(*values.keys())
                                c.expireat(
                                    key,
                                    self.calculate_expiry(rollup, self.rollups[rollup], _timestamp),
                                )

    def delete_distinct_counts(
        self,
        models: list[TSDBModel],
        keys: list[int],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments(models, ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), _ids in self.get_cluster_groups(ids):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for _timestamp in series:
                        for model in models:
                            for key in keys:
                                c = client.target_key(key)
                                for environment_id in _ids:
                                    c.delete(
                                        self.make_key(
                                            model,
                                            rollup,
                                            _timestamp.timestamp(),
                                            key,
                                            environment_id,
                                        )
                                    )

    def make_frequency_table_keys(
        self,
        model: TSDBModel,
        rollup: int,
        timestamp: float,
        key: int | str,
        environment_id: int | None,
    ) -> list[str]:
        prefix = self.make_key(model, rollup, timestamp, key, environment_id)
        return [f"{prefix}:i", f"{prefix}:e"]

    def record_frequency_multi(
        self,
        requests: Sequence[tuple[TSDBModel, Mapping[str, Mapping[str, int | float]]]],
        timestamp: datetime | None = None,
        environment_id: int | None = None,
    ) -> None:
        self.validate_arguments([model for model, request in requests], [environment_id])

        if not self.enable_frequency_sketches:
            return

        if timestamp is None:
            timestamp = timezone.now()

        ts = int(timestamp.timestamp())  # ``timestamp`` is not actually a timestamp :(

        for (cluster, durable), environment_ids in self.get_cluster_groups({None, environment_id}):
            commands: dict[str, list] = {}

            for model, request in requests:
                for key, items in request.items():
                    keys = []
                    expirations = {}

                    # Figure out all of the keys we need to be incrementing, as
                    # well as their expiration policies.
                    for rollup, max_values in self.rollups.items():
                        chunk = []
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

    def get_frequency_series(
        self,
        model: TSDBModel,
        items: Mapping[TSDBKey, Sequence[TSDBItem]],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]]:
        self.validate_arguments([model], [environment_id])

        if not self.enable_frequency_sketches:
            raise NotImplementedError("Frequency sketches are disabled.")

        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        # Here we freeze ordering of the members, since we'll be passing these
        # as positional arguments to the Redis script and later associating the
        # results (which are returned in the same order that the arguments were
        # provided) with the original input values to compose the result.
        items = {k: list(members) for k, members in items.items()}

        commands: dict[TSDBKey, list[tuple[Script, list[str], list[str | int]]]] = {}

        arguments = ["ESTIMATE"] + list(self.DEFAULT_SKETCH_PARAMETERS)
        for item_key, members in items.items():
            ks: list[str] = []
            for timestamp in series:
                ks.extend(
                    self.make_frequency_table_keys(
                        model, rollup, timestamp, item_key, environment_id
                    )
                )

            commands[item_key] = [(CountMinScript, ks, arguments + list(members))]

        results: dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]] = {}

        cluster, _ = self.get_cluster(environment_id)
        for _key, responses in cluster.execute_commands(commands).items():
            _members = items[_key]

            chunk = results[_key] = []
            for _timestamp, scores in zip(series, responses[0].value):
                chunk.append((_timestamp, dict(zip(_members, (float(score) for score in scores)))))

        return results

    def merge_frequencies(
        self,
        model: TSDBModel,
        destination: str,
        sources: Sequence[TSDBKey],
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments([model], ids)

        if not self.enable_frequency_sketches:
            return

        rollups: list[tuple[int, list[datetime]]] = []
        for rollup, samples in self.rollups.items():
            _, rollup_series = self.get_optimal_rollup_series(
                to_datetime(self.get_earliest_timestamp(rollup, timestamp=timestamp)),
                end=None,
                rollup=rollup,
            )
            rollups.append((rollup, [to_datetime(item) for item in rollup_series]))

        for (cluster, durable), _ids in self.get_cluster_groups(ids):
            exports: dict[TSDBKey, list[tuple[Script, list[str], list[str]] | list[str]]]
            exports = defaultdict(list)

            for source in sources:
                for rollup, series in rollups:
                    for serie_timestamp in series:
                        keys: list[str] = []
                        for environment_id in _ids:
                            keys.extend(
                                self.make_frequency_table_keys(
                                    model,
                                    rollup,
                                    serie_timestamp.timestamp(),
                                    source,
                                    environment_id,
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
                    for _timestamp in series:
                        for environment_id, payload in zip(_ids, next(results).value):
                            imports.append(
                                (
                                    CountMinScript,
                                    self.make_frequency_table_keys(
                                        model,
                                        rollup,
                                        _timestamp.timestamp(),
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
        self,
        models: list[TSDBModel],
        keys: Iterable[str],
        start: datetime | None = None,
        end: datetime | None = None,
        timestamp: datetime | None = None,
        environment_ids: Iterable[int] | None = None,
    ) -> None:
        ids = (set(environment_ids) if environment_ids is not None else set()).union([None])

        self.validate_arguments(models, ids)

        rollups = self.get_active_series(start, end, timestamp)

        for (cluster, durable), _environment_ids in self.get_cluster_groups(ids):
            manager = cluster.fanout()
            if not durable:
                manager = SuppressionWrapper(manager)

            with manager as client:
                for rollup, series in rollups.items():
                    for timestamp in series:
                        for model in models:
                            for key in keys:
                                c = client.target_key(key)
                                for environment_id in _environment_ids:
                                    for k in self.make_frequency_table_keys(
                                        model, rollup, timestamp.timestamp(), key, environment_id
                                    ):
                                        c.delete(k)
