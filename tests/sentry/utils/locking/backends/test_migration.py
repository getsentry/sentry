from unittest import TestCase
from uuid import uuid4

import pytest

from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.backends.migration import (
    MigrationLockBackend,
    default_locks_selector,
    post_process_locks_selector,
)
from sentry.utils.locking.backends.redis import RedisLockBackend


class DummyLockBackend(LockBackend):
    path = "tests.sentry.utils.locking.backends.test_migration.DummyLockBackend"

    def __init__(self):
        self._locks = {}

    def acquire(self, key: str, duration: int, routing_key: str | None = None) -> None:
        if self.locked(key=key, routing_key=routing_key):
            raise AssertionError(f"Could not acquire ({key}, {routing_key})")
        self._locks[(key, routing_key)] = duration

    def release(self, key, routing_key=None):
        del self._locks[(key, routing_key)]

    def locked(self, key, routing_key=None):
        return (key, routing_key) in self._locks


class TestMigrationLockBackend(TestCase):
    def test_build_from_configs(self) -> None:
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

    def test_acquire_check_old_backend(self) -> None:
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

    def test_lock_check_both_backends(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        lk = "hello"
        backend.backend_old.acquire(lk, 10)
        assert backend.locked(lk)

        def selector_plzno_call(key, routing_key, backend_new, backend_old):
            raise AssertionError("should not be called!")

        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
            selector_func_path=selector_plzno_call,
        )
        backend.backend_new.acquire(lk, 10)
        assert backend.locked(lk)

    def test_release_both_backends(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        backend.backend_new.acquire("hello", 10)
        backend.backend_old.acquire("hello", 10)
        assert backend.locked("hello")
        backend.release("hello")
        assert not backend.locked("hello")


# Two real Redis backends, kept apart by their key prefix. Each MigrationLockBackend
# instance builds its own backends with its own token, like a separate process.
OLD_CONFIG = {
    "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
    "options": {"cluster": "default", "prefix": "migration-test-old:"},
}
NEW_CONFIG = {
    "path": "sentry.utils.locking.backends.redis.RedisClusterLockBackend",
    "options": {"cluster": "default", "prefix": "migration-test-new:"},
}


class UnavailableLockBackend(LockBackend):
    """Stands in for a Redis that cannot be reached."""

    path = "tests.sentry.utils.locking.backends.test_migration.UnavailableLockBackend"

    def acquire(self, key: str, duration: int, routing_key: str | None = None) -> None:
        raise ConnectionError("unavailable")

    def release(self, key, routing_key=None):
        raise ConnectionError("unavailable")

    def locked(self, key, routing_key=None):
        raise ConnectionError("unavailable")


def pick_new(key, routing_key, backend_new, backend_old):
    return backend_new


def pick_old(key, routing_key, backend_new, backend_old):
    return backend_old


class SwitchableSelector:
    def __init__(self, use_new: bool) -> None:
        self.use_new = use_new

    def __call__(self, key, routing_key, backend_new, backend_old):
        return backend_new if self.use_new else backend_old


class TestMigrationLockBackendOnRedis(TestCase):
    def setUp(self) -> None:
        self.key = f"lock-{uuid4().hex}"

    def build(self, selector, **kwargs) -> MigrationLockBackend:
        return MigrationLockBackend(
            backend_new_config=NEW_CONFIG,
            backend_old_config=OLD_CONFIG,
            selector_func_path=selector,
            **kwargs,
        )

    def test_caller_on_new_is_blocked_by_holder_on_old(self) -> None:
        holder = self.build(pick_old)
        caller = self.build(pick_new)
        holder.acquire(self.key, 10)

        with pytest.raises(Exception):
            caller.acquire(self.key, 10)
        assert not caller.backend_new.locked(self.key)

    def test_caller_on_old_is_blocked_by_holder_on_new(self) -> None:
        # A rollback, or a process that still reads an old option value.
        holder = self.build(pick_new)
        caller = self.build(pick_old)
        holder.acquire(self.key, 10)

        with pytest.raises(Exception):
            caller.acquire(self.key, 10)
        assert not caller.backend_old.locked(self.key)

    def test_release_after_selector_change(self) -> None:
        selector = SwitchableSelector(use_new=False)
        backend = self.build(selector)
        backend.acquire(self.key, 10)

        selector.use_new = True
        backend.release(self.key)
        assert not backend.locked(self.key)

    def test_release_raises_when_no_lock_is_held(self) -> None:
        with pytest.raises(Exception):
            self.build(pick_new).release(self.key)

    def test_release_keeps_lock_of_other_process(self) -> None:
        holder = self.build(pick_old)
        other = self.build(pick_old)
        holder.acquire(self.key, 10)

        with pytest.raises(Exception):
            other.release(self.key)
        assert holder.locked(self.key)

    def build_with_unavailable_new(self, **kwargs) -> MigrationLockBackend:
        return MigrationLockBackend(
            backend_new_config={"path": UnavailableLockBackend.path},
            backend_old_config=OLD_CONFIG,
            selector_func_path=pick_old,
            **kwargs,
        )

    def test_check_error_fails_closed_without_option(self) -> None:
        backend = self.build_with_unavailable_new()

        with pytest.raises(Exception):
            backend.acquire(self.key, 10)
        assert not backend.backend_old.locked(self.key)

    def test_check_error_fails_closed_when_option_read_fails(self) -> None:
        # Reading an option that is not registered raises.
        backend = self.build_with_unavailable_new(fail_open_option="locks.not-a-registered-option")

        with pytest.raises(Exception):
            backend.acquire(self.key, 10)
        assert not backend.backend_old.locked(self.key)

    def test_check_error_follows_option_at_runtime(self) -> None:
        backend = self.build_with_unavailable_new(
            fail_open_option="locks.post-process.migration-fail-open"
        )

        with override_options({"locks.post-process.migration-fail-open": True}):
            backend.acquire(self.key, 10)
        assert backend.backend_old.locked(self.key)
        backend.backend_old.release(self.key)

        with override_options({"locks.post-process.migration-fail-open": False}):
            with pytest.raises(Exception):
                backend.acquire(self.key, 10)
        assert not backend.backend_old.locked(self.key)


@django_db_all
def test_check_error_fails_closed_by_option_default() -> None:
    backend = MigrationLockBackend(
        backend_new_config={"path": UnavailableLockBackend.path},
        backend_old_config=OLD_CONFIG,
        selector_func_path=pick_old,
        fail_open_option="locks.post-process.migration-fail-open",
    )
    key = f"lock-{uuid4().hex}"

    with pytest.raises(Exception):
        backend.acquire(key, 10)
    assert not backend.backend_old.locked(key)


class TestRolloutSelectors(TestCase):
    new = DummyLockBackend()
    old = DummyLockBackend()
    keys = [f"key-{i}" for i in range(1000)]

    def picks(self, selector) -> list[LockBackend]:
        return [selector(key, None, self.new, self.old) for key in self.keys]

    def test_rate_zero_and_one(self) -> None:
        with override_options({"locks.post-process.migration-rollout-rate": 0.0}):
            assert all(b is self.old for b in self.picks(post_process_locks_selector))
        with override_options({"locks.post-process.migration-rollout-rate": 1.0}):
            assert all(b is self.new for b in self.picks(post_process_locks_selector))

    def test_partial_rate_is_stable_per_key(self) -> None:
        with override_options({"locks.post-process.migration-rollout-rate": 0.5}):
            first = self.picks(post_process_locks_selector)
            assert first == self.picks(post_process_locks_selector)
        assert 400 < sum(b is self.new for b in first) < 600

    def test_raising_the_rate_only_moves_keys_to_new(self) -> None:
        with override_options({"locks.post-process.migration-rollout-rate": 0.2}):
            low = self.picks(post_process_locks_selector)
        with override_options({"locks.post-process.migration-rollout-rate": 0.6}):
            high = self.picks(post_process_locks_selector)
        assert all(h is self.new for lo, h in zip(low, high) if lo is self.new)

    def test_each_selector_reads_its_own_option(self) -> None:
        with override_options(
            {
                "locks.default.migration-rollout-rate": 1.0,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            assert all(b is self.new for b in self.picks(default_locks_selector))
            assert all(b is self.old for b in self.picks(post_process_locks_selector))
