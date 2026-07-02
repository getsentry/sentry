from __future__ import annotations

import math
import time
from collections.abc import Callable
from hashlib import md5
from typing import Any

from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster

type _RedisClient = RedisCluster[Any] | StrictRedis[Any]


class Papertrail[T]:
    """
    Probabilistic observation tracker backed by sharded Redis bloom filters.

    Maintains one bloom filter per (shard, hour) window. Observations are
    distributed across shards by hashing the ID, allowing high write throughput
    on a Redis cluster. Each window key expires after a configurable TTL.
    """

    def __init__(
        self,
        client: _RedisClient,
        prefix: str,
        *,
        false_positive_rate: float = 0.01,
        expected_items_per_window: int = 100_000,
        num_shards: int = 16,
        ttl_hours: int = 24,
        time_fn: Callable[[], float] = time.time,
    ) -> None:
        if false_positive_rate <= 0 or false_positive_rate >= 1:
            raise ValueError("false_positive_rate must be in (0, 1)")
        if expected_items_per_window <= 0:
            raise ValueError("expected_items_per_window must be positive")
        if num_shards <= 0:
            raise ValueError("num_shards must be positive")

        self._client = client
        self._prefix = prefix
        self._num_shards = num_shards
        self._time_fn = time_fn
        self._ttl_seconds = (ttl_hours + 1) * 3600  # +1 hour buffer for in-progress windows

        items_per_shard = expected_items_per_window / num_shards
        ln2 = math.log(2)
        # Optimal bloom filter parameters
        self._bits_per_shard = math.ceil(
            -items_per_shard * math.log(false_positive_rate) / (ln2**2)
        )
        self._num_hashes = max(1, round(self._bits_per_shard / items_per_shard * ln2))

    def _hour_key(self, shard: int, hour_ts: int) -> str:
        return f"{self._prefix}:pt:{shard}:{hour_ts}"

    def _current_hour(self) -> int:
        return int(self._time_fn() // 3600)

    def _shard_and_positions(self, item_id: T) -> tuple[int, list[int]]:
        # Double hashing, a la Kirsch and Mitzenmacher.
        digest = md5(str(item_id).encode(), usedforsecurity=False).digest()
        h1 = int.from_bytes(digest[:8], "big")
        # If h2 shares a common factor with _bits_per_shard, positions cluster.
        # Forcing h2 odd avoids the most common case (shared factor of 2).
        h2 = int.from_bytes(digest[8:], "big") | 1
        shard = h1 % self._num_shards
        positions = [(h1 + i * h2) % self._bits_per_shard for i in range(self._num_hashes)]
        return shard, positions

    def observe(self, item_id: T) -> None:
        shard, positions = self._shard_and_positions(item_id)
        key = self._hour_key(shard, self._current_hour())
        with self._client.pipeline(transaction=False) as p:
            for pos in positions:
                p.setbit(key, pos, 1)
            p.expire(key, self._ttl_seconds)
            p.execute()

    def was_observed(self, item_id: T, hours_ago: int = 0) -> bool:
        if hours_ago < 0:
            raise ValueError("hours_ago must be non-negative")
        shard, positions = self._shard_and_positions(item_id)
        hour_ts = self._current_hour() - hours_ago
        key = self._hour_key(shard, hour_ts)
        with self._client.pipeline(transaction=False) as p:
            for pos in positions:
                p.getbit(key, pos)
            results = p.execute()
        return all(results)
