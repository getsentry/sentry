from typing import Optional
from unittest import TestCase

import pytest

from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.backends.migration import MigrationLockBackend
from sentry.utils.locking.backends.redis import RedisLockBackend


class DummyLockBackend(LockBackend):
    path = "tests.sentry.utils.locking.backends.test_migration.DummyLockBackend"

    def __init__(self):
        self._locks = {}

    def acquire(self, key: str, duration: int, routing_key: Optional[str] = None) -> None:
        if self.locked(key=key, routing_key=routing_key):
            raise Exception(f"Could not acquire ({key}, {routing_key})")
        self._locks[(key, routing_key)] = duration

    def release(self, key, routing_key=None):
        del self._locks[(key, routing_key)]

    def locked(self, key, routing_key=None):
        return (key, routing_key) in self._locks


class TestMigrationLockBackend(TestCase):
    def test_build_from_configs(self):
        backend = MigrationLockBackend(
            backend_new_config={
                "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
                "options": {"cluster": "default"},
            },
            backend_old_config={
                "path": DummyLockBackend.path,
            },
        )
        assert isinstance(backend.backend_new, RedisLockBackend)
        assert isinstance(backend.backend_old, DummyLockBackend)

    def test_acquire_check_old_backend(self):
        # default selector function always returns new backend
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        lk = "hello"
        backend.backend_old.acquire(lk, 10)
        with pytest.raises(Exception):
            backend.acquire(lk, 10)
        backend.backend_old.release(lk)
        backend.acquire(lk, 10)

    def test_lock_check_both_backends(self):
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        lk = "hello"
        backend.backend_old.acquire(lk, 10)
        assert backend.locked(lk)

        def selector_always_old(key, routing_key, backend_new, backend_old):
            return backend_old

        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
            selector_func_path=selector_always_old,
        )
        backend.backend_new.acquire(lk, 10)
        assert backend.locked(lk)

    def test_release_both_backends(self):
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        backend.backend_new.acquire("hello", 10)
        backend.backend_old.acquire("hello", 10)
        assert backend.locked("hello")
        backend.release("hello")
        assert not backend.locked("hello")
