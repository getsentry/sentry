from __future__ import annotations

from functools import cached_property
from unittest import TestCase, mock
from uuid import uuid4

import pytest
from redis.client import StrictRedis
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import ResponseError
from sentry_redis_tools.clients import RedisCluster

from sentry.exceptions import InvalidConfiguration
from sentry.testutils.helpers.options import override_options
from sentry.utils.locking import LockNotOwned
from sentry.utils.locking.backends.redis import BaseRedisLockBackend, RedisClusterLockBackend
from sentry.utils.locking.lock import Lock
from sentry.utils.redis import redis_clusters


class RedisBackendTestCaseBase:
    backend_class: type[BaseRedisLockBackend]

    @property
    def cluster(self) -> RedisCluster[str] | StrictRedis[str]:
        raise NotImplementedError

    @property
    def backend(self) -> BaseRedisLockBackend:
        return self.backend_class(self.cluster, uuid="09cd7348c93f4198995177a57216e620")

    def test_success(self) -> None:
        key = "\U0001f4a9"
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

    def test_acquire_fail_on_conflict(self) -> None:
        key = "lock"
        duration = 60

        other_cluster = self.backend_class(self.cluster)
        other_cluster.acquire(key, duration)
        with pytest.raises(Exception):
            self.backend.acquire(key, duration)

    def test_release_fail_on_missing(self) -> None:
        with pytest.raises(LockNotOwned, match="^NOLOCK") as excinfo:
            self.backend.release(f"missing-{uuid4().hex}")
        # Callers that catch RedisError recognize this only while it stays a ResponseError.
        assert isinstance(excinfo.value, ResponseError)

    def test_release_fail_on_conflict(self) -> None:
        key = "lock"
        duration = 60
        self.backend.get_client(key).set(self.backend.prefix_key(key), "someone-elses-uuid")

        with pytest.raises(Exception):
            self.backend.acquire(key, duration)

    def test_release_wrong_token_raises_lock_not_owned(self) -> None:
        key = f"lock-{uuid4().hex}"
        self.backend.acquire(key, 60, token="holder")
        with pytest.raises(LockNotOwned, match="^LOCKHELD"):
            self.backend.release(key, token="other")
        assert self.backend.locked(key)
        self.backend.release(key, token="holder")
        assert not self.backend.locked(key)

    def test_lock_stale_release_does_not_delete_newer_hold(self) -> None:
        # Delete stands in for lease expiry. The script only sees that the key is gone.
        key = f"lock-{uuid4().hex}"
        client = self.backend.get_client(key)
        full_key = self.backend.prefix_key(key)

        first = Lock(self.backend, key, 60)
        first.acquire()
        client.delete(full_key)

        second = Lock(self.backend, key, 60)
        second.acquire()
        assert first.token != second.token

        first.release()
        assert self.backend.locked(key)

        second.release()
        assert not self.backend.locked(key)

    def test_other_process_stale_release_leaves_the_newer_hold(self) -> None:
        # A second backend has its own uuid, which is what another process has.
        key = f"lock-{uuid4().hex}"
        first_backend = self.backend_class(self.cluster)
        second_backend = self.backend_class(self.cluster)
        assert first_backend.uuid != second_backend.uuid
        client = first_backend.get_client(key)

        first = Lock(first_backend, key, 60)
        first.acquire()
        client.delete(first_backend.prefix_key(key))

        second = Lock(second_backend, key, 60)
        second.acquire()
        first.release()
        assert second_backend.locked(key)
        second.release()

    def test_release_connection_error_is_not_lock_not_owned(self) -> None:
        key = f"lock-{uuid4().hex}"
        self.backend.acquire(key, 60, token="holder")
        with (
            mock.patch(
                "sentry.utils.locking.backends.redis.delete_lock",
                side_effect=RedisConnectionError("down"),
            ),
            pytest.raises(RedisConnectionError),
        ):
            self.backend.release(key, token="holder")
        assert self.backend.locked(key)
        self.backend.release(key, token="holder")

    def test_locked(self) -> None:
        key = "lock:testkey"
        duration = 60
        assert self.backend.locked(key) is False

        self.backend.acquire(key, duration)
        assert self.backend.locked(key)
        self.backend.release(key)

    def test_cluster_as_str(self) -> None:
        assert self.backend_class(cluster="default").cluster == self.cluster


class RedisClusterLockBackendTestCase(RedisBackendTestCaseBase, TestCase):
    backend_class = RedisClusterLockBackend

    @cached_property
    def cluster(self) -> RedisCluster[str] | StrictRedis[str]:
        return redis_clusters.get("default")


class RedisClusterLockBackendConfigurationTestCase(TestCase):
    def test_multi_host_cluster_without_is_redis_cluster_raises_clear_error(self) -> None:
        clusters_config = {
            "locks-multi-host": {"hosts": {0: {"db": 0}, 1: {"db": 1}}},
        }
        with override_options({"redis.clusters": clusters_config}):
            with pytest.raises(InvalidConfiguration) as excinfo:
                RedisClusterLockBackend("locks-multi-host")

        message = str(excinfo.value)
        assert "'locks-multi-host'" in message
        assert "exactly one host" in message
        assert "is_redis_cluster" in message

    def test_unknown_cluster_still_raises_key_error(self) -> None:
        with pytest.raises(KeyError, match="Invalid cluster name"):
            RedisClusterLockBackend("locks-does-not-exist")
