from __future__ import annotations

import logging
import time
from collections import defaultdict
from collections.abc import Mapping
from typing import Any, TypeAlias

from redis.client import Pipeline

ClusterPipeline: TypeAlias = Any

from sentry.buffer.base import BufferField
from sentry.buffer.redis import make_key
from sentry.db import models
from sentry.utils import metrics
from sentry.utils.redis import (
    get_dynamic_cluster_from_options,
    is_instance_rb_cluster,
    is_instance_redis_cluster,
)

logger = logging.getLogger(__name__)


# For write operations, we set expiry.
_NEED_EXPIRE = {
    "hset": True,
    "hmset": True,
    "hgetall": False,
    "hlen": False,
    "zadd": True,
    "zrangebyscore": False,
    "zrem": True,
    "zremrangebyscore": True,
}


class RedisHashSortedSetBuffer:
    """
    Standalone Redis buffer helper for hash and sorted set operations.

    This class provides Redis hash and sorted set operations for batch work scheduling,
    used by workflow engine.
    """

    key_expire = 60 * 60  # 1 hour

    def __init__(self, cfg_key_name: str = "", config: dict[str, Any] | None = None):
        """Initialize with Redis cluster configuration."""
        self.is_redis_cluster, self.cluster, _ = get_dynamic_cluster_from_options(
            cfg_key_name, config or {}
        )

    def _get_redis_connection(
        self, key: str | None, transaction: bool = True
    ) -> ClusterPipeline | Pipeline[str]:
        """Get a Redis connection pipeline for the given key."""
        conn: ClusterPipeline | Pipeline[str]
        if is_instance_redis_cluster(self.cluster, self.is_redis_cluster):
            conn = self.cluster
        elif is_instance_rb_cluster(self.cluster, self.is_redis_cluster):
            # For RB clusters, use get_local_client_for_key to get the actual connection
            assert key is not None
            conn = self.cluster.get_local_client_for_key(key)
        else:
            # For standalone Redis
            conn = self.cluster

        return conn.pipeline(transaction=transaction)

    def _execute_redis_operation(
        self, key: str, operation_name: str, *args: Any, **kwargs: Any
    ) -> Any:
        """Execute a Redis operation on the given key."""
        pipe = self._get_redis_connection(key, transaction=False)
        operation = getattr(pipe, operation_name)
        operation(key, *args, **kwargs)
        if _NEED_EXPIRE[operation_name]:
            pipe.expire(key, self.key_expire)
        result = pipe.execute()[0]
        metrics.incr(f"redis_buffer.{operation_name}")
        return result

    def _execute_sharded_redis_operation(
        self, keys: list[str], operation_name: str, *args: Any, **kwargs: Any
    ) -> Any:
        """Execute a Redis operation on multiple keys."""
        assert keys
        pipe = self._get_redis_connection("UNUSED", transaction=False)
        for key in keys:
            operation = getattr(pipe, operation_name)
            operation(key, *args, **kwargs)
            # Don't add expire for read operations like zrangebyscore
            if _NEED_EXPIRE[operation_name]:
                pipe.expire(key, self.key_expire)
        result = pipe.execute()
        metrics.incr(f"redis_buffer.{operation_name}", amount=len(keys))
        return result

    def push_to_hash(
        self,
        model: type[models.Model],
        filters: Mapping[str, BufferField],
        field: str,
        value: str,
    ) -> None:
        """Push a field-value pair to a Redis hash."""
        key = make_key(model, filters)
        self._execute_redis_operation(key, "hset", field, value)

    def push_to_hash_bulk(
        self,
        model: type[models.Model],
        filters: Mapping[str, BufferField],
        data: dict[str, str],
    ) -> None:
        """Push multiple field-value pairs to a Redis hash."""
        key = make_key(model, filters)
        self._execute_redis_operation(key, "hmset", data)

    def get_hash(
        self, model: type[models.Model], field: Mapping[str, BufferField]
    ) -> dict[str, str]:
        """Get all field-value pairs from a Redis hash."""
        key = make_key(model, field)
        redis_hash = self._execute_redis_operation(key, "hgetall")
        decoded_hash = {}
        for k, v in redis_hash.items():
            if isinstance(k, bytes):
                k = k.decode("utf-8")
            if isinstance(v, bytes):
                v = v.decode("utf-8")
            decoded_hash[k] = v
        return decoded_hash

    def get_hash_length(self, model: type[models.Model], field: Mapping[str, BufferField]) -> int:
        """Get the number of fields in a Redis hash."""
        key = make_key(model, field)
        return self._execute_redis_operation(key, "hlen")

    def delete_hash(
        self,
        model: type[models.Model],
        filters: Mapping[str, BufferField],
        fields: list[str],
    ) -> None:
        """Delete specific fields from a Redis hash."""
        key = make_key(model, filters)
        pipe = self._get_redis_connection(key, transaction=False)
        for field in fields:
            pipe.hdel(key, field)
        pipe.expire(key, self.key_expire)
        pipe.execute()
        metrics.incr("redis_buffer.hdel", amount=len(fields))

    def push_to_sorted_set(self, key: str, value: list[int] | int) -> None:
        """Add one or more values to a Redis sorted set with current timestamp as score."""
        now = time.time()
        if isinstance(value, list):
            value_dict = {v: now for v in value}
        else:
            value_dict = {value: now}
        self._execute_redis_operation(key, "zadd", value_dict)

    def get_sorted_set(self, key: str, min: float, max: float) -> list[tuple[int, float]]:
        """Get values from a Redis sorted set within a score range."""
        redis_set = self._execute_redis_operation(
            key,
            "zrangebyscore",
            min=min,
            max=max,
            withscores=True,
        )
        decoded_set = []
        for items in redis_set:
            item = items[0]
            if isinstance(item, bytes):
                item = item.decode("utf-8")
            data_and_timestamp = (int(item), items[1])
            decoded_set.append(data_and_timestamp)
        return decoded_set

    def bulk_get_sorted_set(
        self, keys: list[str], min: float, max: float
    ) -> dict[int, list[float]]:
        """Get values from multiple Redis sorted sets within a score range."""
        data_to_timestamps: dict[int, list[float]] = defaultdict(list)

        if not keys:
            return data_to_timestamps

        if not self.is_redis_cluster:
            # Slow path for RB support.
            for key in keys:
                for member, score in self.get_sorted_set(key, min, max):
                    data_to_timestamps[int(member)].append(score)
            return data_to_timestamps

        redis_set = self._execute_sharded_redis_operation(
            keys,
            "zrangebyscore",
            min=min,
            max=max,
            withscores=True,
        )

        # redis_set should be a list of results, one per key
        if not isinstance(redis_set, list):
            logger.warning(
                "Expected list from bulk_get_sorted_set, got %s: %s", type(redis_set), redis_set
            )
            return data_to_timestamps

        for result in redis_set:
            if result:  # Skip empty results
                for items in result:
                    item = items[0]
                    if isinstance(item, bytes):
                        item = item.decode("utf-8")
                    data_to_timestamps[int(item)].append(items[1])

        return data_to_timestamps

    def delete_key(self, key: str, min: float, max: float) -> None:
        """Delete values from a Redis sorted set within a score range."""
        self._execute_redis_operation(key, "zremrangebyscore", min=min, max=max)

    def delete_keys(self, keys: list[str], min: float, max: float) -> None:
        """Delete values from multiple Redis sorted sets within a score range."""
        if not self.is_redis_cluster:
            for key in keys:
                self.delete_key(key, min, max)
        else:
            self._execute_sharded_redis_operation(keys, "zremrangebyscore", min=min, max=max)
