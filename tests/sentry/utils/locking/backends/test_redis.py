from __future__ import annotations

from functools import cached_property
from unittest import TestCase

import pytest

from sentry.utils.locking.backends.redis import (
    BaseRedisLockBackend,
    RedisClusterLockBackend,
    RedisLockBackend,
)
from sentry.utils.redis import clusters, redis_clusters


class RedisBackendTestCaseBase:
    backend_class: type[BaseRedisLockBackend]

    @property
    def cluster(self):
        raise NotImplementedError

    @property
    def backend(self):
        return self.backend_class(self.cluster, uuid="09cd7348c93f4198995177a57216e620")

    def test_success(self):
        key = "\U0001F4A9"
        duration = 60
        full_key = self.backend.prefix_key(key)
        client = self.backend.get_client(key)

        self.backend.acquire(key, duration)

        val = client.get(full_key)
        if isinstance(val, bytes):
            val = val.decode("utf-8")

        assert val == self.backend.uuid

        assert duration - 2 < float(client.ttl(full_key)) <= duration

        self.backend.release(key)
        assert not client.exists(full_key)

    def test_acquire_fail_on_conflict(self):
        key = "lock"
        duration = 60

        other_cluster = self.backend_class(self.cluster)
        other_cluster.acquire(key, duration)
        with pytest.raises(Exception):
            self.backend.acquire(key, duration)

    def test_release_fail_on_missing(self):
        with pytest.raises(Exception):
            self.backend.release("missing-key")

    def test_release_fail_on_conflict(self):
        key = "lock"
        duration = 60
        self.backend.get_client(key).set(self.backend.prefix_key(key), "someone-elses-uuid")

        with pytest.raises(Exception):
            self.backend.acquire(key, duration)

    def test_locked(self):
        key = "lock:testkey"
        duration = 60
        assert self.backend.locked(key) is False

        self.backend.acquire(key, duration)
        assert self.backend.locked(key)
        self.backend.release(key)

    def test_cluster_as_str(self):
        assert self.backend_class(cluster="default").cluster == self.cluster


class RedisLockBackendTestCase(RedisBackendTestCaseBase, TestCase):
    backend_class = RedisLockBackend

    @cached_property
    def cluster(self):
        return clusters.get("default")


class RedisClusterLockBackendTestCase(RedisBackendTestCaseBase, TestCase):
    backend_class = RedisClusterLockBackend

    @cached_property
    def cluster(self):
        return redis_clusters.get("default")
