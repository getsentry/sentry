from __future__ import annotations

import logging
import time
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any, TypeAlias, TypeVar

import pydantic
import rb
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
    load_redis_script,
)

logger = logging.getLogger(__name__)


def _decode_redis_value(value: Any) -> str:
    """Helper to decode Redis values that might be bytes or strings."""
    return value.decode("utf-8") if isinstance(value, bytes) else str(value)


T = TypeVar("T")


def _by_pairs(seq: list[T]) -> Iterable[tuple[T, T]]:
    if len(seq) % 2 != 0:
        raise ValueError("List has an odd number of elements")
    it = iter(seq)
    return zip(it, it)


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
    "set": True,
    "get": False,
}


class RedisHashSortedSetBuffer:
    """
    Standalone Redis buffer helper for hash and sorted set operations.

    This class provides Redis hash and sorted set operations for batch work scheduling,
    used by workflow engine.
    """

    key_expire = 60 * 60  # 1 hour

    def __init__(
        self,
        cfg_key_name: str = "",
        config: dict[str, Any] | None = None,
        now_fn: Callable[[], float] = time.time,
    ):
        """Initialize with Redis cluster configuration."""
        self.is_redis_cluster, self.cluster, _ = get_dynamic_cluster_from_options(
            cfg_key_name, config or {}
        )
        self.now_fn = now_fn

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
        self, keys: Sequence[str], operation_name: str, *args: Any, **kwargs: Any
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
        self, model: type[models.Model], filters: Mapping[str, BufferField]
    ) -> dict[str, str]:
        """Get all field-value pairs from a Redis hash."""
        key = make_key(model, filters)
        redis_hash = self._execute_redis_operation(key, "hgetall")
        decoded_hash = {}
        for k, v in redis_hash.items():
            k = _decode_redis_value(k)
            v = _decode_redis_value(v)
            decoded_hash[k] = v
        return decoded_hash

    def get_hash_length(self, model: type[models.Model], filters: Mapping[str, BufferField]) -> int:
        """Get the number of fields in a Redis hash."""
        key = make_key(model, filters)
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
        now = self.now_fn()
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
            item = _decode_redis_value(item)
            data_and_timestamp = (int(item), items[1])
            decoded_set.append(data_and_timestamp)
        return decoded_set

    def bulk_get_sorted_set(
        self, keys: Sequence[str], min: float, max: float
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
                    item = _decode_redis_value(item)
                    data_to_timestamps[int(item)].append(items[1])

        return data_to_timestamps

    def delete_key(self, key: str, min: float, max: float) -> None:
        """Delete values from a Redis sorted set within a score range."""
        self._execute_redis_operation(key, "zremrangebyscore", min=min, max=max)

    def delete_keys(self, keys: Sequence[str], min: float, max: float) -> None:
        """Delete values from multiple Redis sorted sets within a score range."""
        if not self.is_redis_cluster:
            for key in keys:
                self.delete_key(key, min, max)
        else:
            self._execute_sharded_redis_operation(keys, "zremrangebyscore", min=min, max=max)

    # Lua script for conditional sorted set member removal
    _conditional_zrem_script = load_redis_script("alerts/conditional_zrem.lua")

    def _calculate_key_slot(self, key: str) -> int:
        """
        Calculate the Redis cluster slot for a given key.
        Returns 0 for non-cluster setups (all keys in same "virtual slot").
        """
        if not self.is_redis_cluster:
            return 0  # All keys go to same "slot" for non-cluster

        # Use the cluster client's built-in slot calculation
        try:
            return self.cluster.connection_pool.nodes.keyslot(key)
        except AttributeError:
            # Fallback for standalone Redis using cluster client
            return 0  # Treat as single slot

    def _group_keys_by_slot(self, keys: Sequence[str]) -> list[list[str]]:
        """Group keys by their Redis cluster slot."""
        slot_groups: defaultdict[int, list[str]] = defaultdict(list)
        for key in keys:
            slot = self._calculate_key_slot(key)
            slot_groups[slot].append(key)
        return list(slot_groups.values())

    def _parse_slot_result(
        self, slot_result: list[Any], slot_keys: Sequence[str]
    ) -> dict[str, list[int]]:
        """Parse flat array result from Lua script and return results dict."""
        # Parse flat array result: [key1, member1, key1, member2, key2, member3, ...]
        slot_results_dict: defaultdict[str, list[int]] = defaultdict(list)
        for key_raw, member_raw in _by_pairs(slot_result):
            key = _decode_redis_value(key_raw)
            member_int = int(_decode_redis_value(member_raw))
            slot_results_dict[key].append(member_int)

        # Ensure all slot keys have entries in results
        return {key: slot_results_dict.get(key, []) for key in slot_keys}

    def _ensure_script_loaded_on_cluster(self) -> None:
        """
        Ensure the conditional delete script is loaded on all master nodes in the cluster.
        This is necessary before using execute_command("EVALSHA", ...) in pipelines.
        """
        if not self.is_redis_cluster:
            return  # Not needed for non-cluster setups

        # Check if script exists on the cluster
        script_exists = self.cluster.script_exists(self._conditional_zrem_script.sha)

        # script_exists returns a list in cluster mode, True/False in standalone
        needs_loading = False
        if isinstance(script_exists, list):
            # In cluster mode, ensure all nodes have the script
            needs_loading = not all(script_exists)
        else:
            needs_loading = not script_exists

        if needs_loading:
            # Load script on all master nodes
            self.cluster.script_load(self._conditional_zrem_script.script)

    def conditional_delete_from_sorted_sets(
        self, keys: Sequence[str], members_and_scores: list[tuple[int, float]]
    ) -> dict[str, list[int]]:
        """
        Conditionally delete members from multiple Redis sorted sets.

        Only removes members from a sorted set if their current score is <= the provided score.
        This is useful for safe cleanup where you only want to remove items that haven't been
        updated since a certain time.

        Returns a dictionary of keys and the members that were deleted.
        """
        if not keys:
            raise ValueError("Keys list cannot be empty")

        if not members_and_scores:
            return {key: [] for key in keys}

        cluster = self.cluster
        if is_instance_rb_cluster(cluster, self.is_redis_cluster):
            return self._conditional_delete_rb_fallback(cluster, keys, members_and_scores)

        # Fast path for RedisCluster - group keys by slot for optimal batching
        script_args = []
        for member, score in members_and_scores:
            script_args.extend([str(member), str(score)])

        # Group keys by Redis cluster slot for efficient batching
        slot_groups = self._group_keys_by_slot(keys)

        # Ensure script is loaded before any execution
        self._ensure_script_loaded_on_cluster()

        # Pipeline all slot group executions
        pipe = cluster.pipeline(transaction=False)
        for slot_keys in slot_groups:
            pipe.execute_command(
                "EVALSHA",
                self._conditional_zrem_script.sha,
                len(slot_keys),
                *slot_keys,
                *script_args,
            )
        results = pipe.execute()

        # Process pipelined results
        if len(results) != len(slot_groups):
            raise RuntimeError(
                f"Pipeline mismatch: expected {len(slot_groups)} results, got {len(results)}"
            )

        # Parse results and aggregate into final result
        converted_results = {
            key: members
            for slot_result, slot_keys in zip(results, slot_groups)
            for key, members in self._parse_slot_result(slot_result, slot_keys).items()
        }

        return converted_results

    def _group_keys_by_host_rb(
        self, cluster: rb.Cluster, keys: Sequence[str]
    ) -> dict[str, list[str]]:
        """Group keys by their rb.Cluster host for efficient batching."""
        host_groups: defaultdict[str, list[str]] = defaultdict(list)
        router = cluster.get_router()

        for key in keys:
            host = router.get_host_for_key(key)
            host_groups[host].append(key)

        return dict(host_groups)

    def _conditional_delete_rb_fallback(
        self, cluster: rb.Cluster, keys: Sequence[str], members_and_scores: list[tuple[int, float]]
    ) -> dict[str, list[int]]:
        """
        Fallback implementation for rb.Cluster using atomic Lua script execution.
        Groups keys by host for efficient batching.
        """
        # Flatten the list for Lua script ARGV: [member1, max_score1, member2, max_score2, ...]
        script_args = []
        for member, score in members_and_scores:
            script_args.extend([str(member), str(score)])

        # Group keys by host for efficient batching
        host_groups = self._group_keys_by_host_rb(cluster, keys)

        # Execute script once per host group
        converted_results = {}
        for host, host_keys in host_groups.items():
            # Get client for this specific host
            client = cluster.get_local_client_for_key(host_keys[0])

            # Use the script as a callable - it handles NoScriptError fallback automatically
            result = self._conditional_zrem_script(keys=host_keys, args=script_args, client=client)

            # Parse and merge results from this host
            host_parsed = self._parse_slot_result(result, host_keys)
            converted_results.update(host_parsed)

        return converted_results

    def get_parsed_key[T: pydantic.BaseModel](self, key: str, model: type[T]) -> T | None:
        value = self._execute_redis_operation(key, "get")
        if value is None:
            return None
        return model.parse_raw(value)

    def put_parsed_key[T: pydantic.BaseModel](self, key: str, value: T) -> None:
        self._execute_redis_operation(key, "set", value.json())
