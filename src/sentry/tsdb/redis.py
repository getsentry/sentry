import binascii
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from hashlib import md5
from typing import Any

from django.utils import timezone
from django.utils.encoding import force_bytes

from sentry.exceptions import InvalidConfiguration
from sentry.tsdb.base import (
    BaseTSDB,
    IncrMultiOptions,
    TSDBKey,
    TSDBModel,
)
from sentry.utils.dates import to_datetime
from sentry.utils.redis import redis_clusters


def _crc32(data: bytes) -> int:
    # python 2 equivalent crc32 to return signed
    rv = binascii.crc32(data)
    return rv - ((rv & 0x80000000) << 1)


class RedisTSDB(BaseTSDB):
    """
    A time series storage backend for Redis.

    The backend supports virtual nodes (``vnodes``) which controls shard
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
    """

    def __init__(self, prefix: str = "ts:", vnodes: int = 64, **options: Any):
        if "hosts" in options:
            raise InvalidConfiguration(
                'The TSDB "hosts" option is no longer supported; define the hosts in the '
                '"redis.clusters" option and set the TSDB "cluster" option instead.'
            )
        self.cluster = redis_clusters.get_binary(options.pop("cluster", "default"))
        self.prefix = prefix
        self.vnodes = vnodes
        super().__init__(**options)

    def add_environment_parameter(self, key: str | int, environment_id: int | None) -> str | int:
        if environment_id is not None:
            return f"{key}?e={environment_id}"
        else:
            return key

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
            f"{self.prefix}{model.value}:{self.normalize_to_rollup(timestamp, rollup)}:{vnode}",
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

                for _environment_id in {None, environment_id}:
                    hash_key, hash_field = self.make_counter_key(
                        model, rollup, _timestamp, key, _environment_id
                    )

                    if key_expiries[hash_key] < expiry:
                        key_expiries[hash_key] = expiry

                    key_operations[(hash_key, hash_field)] += count

        pipe = self.cluster.pipeline(transaction=False)
        for (hash_key, hash_field), count in key_operations.items():
            pipe.hincrby(hash_key, str(hash_field), count)
            if key_expiries.get(hash_key):
                pipe.expireat(hash_key, key_expiries.pop(hash_key))
        pipe.execute()

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
        group_on_time: bool = True,
        aggregation_override: str | None = None,
        project_ids: Sequence[int] | None = None,
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

        pipe = self.cluster.pipeline(transaction=False)
        requests: list[tuple[int, TSDBKey]] = []
        for key in keys:
            for timestamp in _series:
                hash_key, hash_field = self.make_counter_key(
                    model, rollup, timestamp, key, environment_id
                )
                pipe.hget(hash_key, str(hash_field))
                requests.append((int(timestamp.timestamp()), key))

        results_by_key: dict[TSDBKey, dict[int, int]] = defaultdict(dict)
        for (epoch, key), count in zip(requests, pipe.execute()):
            results_by_key[key][epoch] = int(count or 0)

        output = {}
        for key, points in results_by_key.items():
            output[key] = sorted(points.items())
        return output
