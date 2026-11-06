from unittest import TestCase
from uuid import uuid4

import pytest

from sentry.conf.types.service_options import ServiceOptions
from sentry.testutils.helpers.options import override_options
from sentry.utils.locking import LockNotOwned
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.backends.migration import (
    MigrationLockBackend,
    SelectorFncType,
    default_locks_selector,
    post_process_locks_selector,
)
from sentry.utils.locking.backends.redis import RedisLockBackend


class DummyLockBackend(LockBackend):
    path = "tests.sentry.utils.locking.backends.test_migration.DummyLockBackend"

    def __init__(self) -> None:
        self._locks: dict[str, int] = {}

    def acquire(self, key: str, duration: int, token: str | None = None) -> None:
        del token
        if self.locked(key=key):
            raise AssertionError(f"Could not acquire {key}")
        self._locks[key] = duration

    def release(self, key: str, token: str | None = None) -> None:
        del token
        del self._locks[key]

    def locked(self, key: str) -> bool:
        return key in self._locks


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

        def selector_plzno_call(
            key: str,
            backend_new: LockBackend,
            backend_old: LockBackend,
        ) -> LockBackend:
            raise AssertionError("should not be called!")

        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
            selector_func_path=selector_plzno_call,
        )
        backend.backend_new.acquire(lk, 10)
        assert backend.locked(lk)

    def test_release_stops_after_picked_backend(self) -> None:
        # default selector function always returns new backend
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        backend.backend_new.acquire("hello", 10)
        backend.backend_old.acquire("hello", 10)
        backend.release("hello")
        assert not backend.backend_new.locked("hello")
        assert backend.backend_old.locked("hello")

    def test_forwards_fencing_token(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        calls: list[tuple[str, str | None]] = []
        original_acquire = backend.backend_new.acquire
        original_release = backend.backend_new.release

        def capture_acquire(key: str, duration: int, token: str | None = None) -> None:
            calls.append(("acquire", token))
            original_acquire(key, duration, token)

        def capture_release(key: str, token: str | None = None) -> None:
            calls.append(("release", token))
            original_release(key, token)

        backend.backend_new.acquire = capture_acquire  # type: ignore[method-assign]
        backend.backend_new.release = capture_release  # type: ignore[method-assign]

        backend.acquire("hello", 10, token="fence")
        backend.release("hello", token="fence")
        assert calls == [("acquire", "fence"), ("release", "fence")]

    def test_backed_off_acquire_releases_with_the_same_token(self) -> None:
        # The holder is on the old backend, so the acquire on the new one backs off.
        # That release has to send the token just written, or the key stays until expiry.
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )
        backend.backend_old.acquire("hello", 10)
        released: list[str | None] = []
        original_release = backend.backend_new.release

        def capture_release(key: str, token: str | None = None) -> None:
            released.append(token)
            original_release(key, token)

        backend.backend_new.release = capture_release  # type: ignore[method-assign]

        with pytest.raises(Exception, match="Could not set key"):
            backend.acquire("hello", 10, token="fence")

        assert released == ["fence"]
        assert not backend.backend_new.locked("hello")

    def test_release_reraises_lock_not_owned_when_every_child_refuses(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )

        def refuse(key: str, token: str | None = None) -> None:
            raise LockNotOwned("NOLOCK No lock at key exists at key: x")

        backend.backend_new.release = refuse  # type: ignore[method-assign]
        backend.backend_old.release = refuse  # type: ignore[method-assign]

        with pytest.raises(LockNotOwned, match="^NOLOCK"):
            backend.release("hello")

    def test_release_wraps_when_a_child_error_is_not_a_refusal(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": DummyLockBackend.path},
            backend_old_config={"path": DummyLockBackend.path},
        )

        def refuse(key: str, token: str | None = None) -> None:
            raise LockNotOwned("NOLOCK No lock at key exists at key: x")

        def down(key: str, token: str | None = None) -> None:
            raise ConnectionError("unavailable")

        backend.backend_new.release = refuse  # type: ignore[method-assign]
        backend.backend_old.release = down  # type: ignore[method-assign]

        with pytest.raises(Exception, match="Could not release key") as excinfo:
            backend.release("hello")
        assert not isinstance(excinfo.value, LockNotOwned)


# Two real Redis backends, kept apart by their key prefix. Each MigrationLockBackend
# instance builds its own backends with its own token, like a separate process.
OLD_CONFIG: ServiceOptions = {
    "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
    "options": {"cluster": "default", "prefix": "migration-test-old:"},
}
NEW_CONFIG: ServiceOptions = {
    "path": "sentry.utils.locking.backends.redis.RedisClusterLockBackend",
    "options": {"cluster": "default", "prefix": "migration-test-new:"},
}


class UnavailableLockBackend(LockBackend):
    """Stands in for a Redis that cannot be reached."""

    path = "tests.sentry.utils.locking.backends.test_migration.UnavailableLockBackend"

    def acquire(self, key: str, duration: int, token: str | None = None) -> None:
        raise ConnectionError("unavailable")

    def release(self, key: str, token: str | None = None) -> None:
        raise ConnectionError("unavailable")

    def locked(self, key: str) -> bool:
        raise ConnectionError("unavailable")


def pick_new(
    key: str,
    backend_new: LockBackend,
    backend_old: LockBackend,
) -> LockBackend:
    return backend_new


def pick_old(
    key: str,
    backend_new: LockBackend,
    backend_old: LockBackend,
) -> LockBackend:
    return backend_old


class SwitchableSelector:
    def __init__(self, use_new: bool) -> None:
        self.use_new = use_new

    def __call__(
        self,
        key: str,
        backend_new: LockBackend,
        backend_old: LockBackend,
    ) -> LockBackend:
        return backend_new if self.use_new else backend_old


class TestMigrationLockBackendOnRedis(TestCase):
    def setUp(self) -> None:
        self.key = f"lock-{uuid4().hex}"

    def build(self, selector: SelectorFncType, **kwargs: object) -> MigrationLockBackend:
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

    def test_check_off_and_rate_zero_does_not_read_new(self) -> None:
        # Before the rollout, a lock on the new backend is not seen.
        holder = self.build(pick_new)
        caller = self.build(post_process_locks_selector)
        holder.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": False,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            caller.acquire(self.key, 10)
        assert caller.backend_old.locked(self.key)

    def test_check_on_at_rate_zero_is_blocked_by_holder_on_new(self) -> None:
        # Rollout start: a process that has the check on but still reads rate 0 must
        # see a lock that a process with the raised rate put on the new backend.
        # Rollback: the same case, after the rate is back at 0 but before the check
        # is turned off.
        holder = self.build(post_process_locks_selector)
        caller = self.build(post_process_locks_selector)
        with override_options(
            {
                "locks.post-process.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 1.0,
            }
        ):
            holder.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            with pytest.raises(Exception):
                caller.acquire(self.key, 10)
        assert not caller.backend_old.locked(self.key)

    def test_rate_above_zero_checks_new_with_check_off(self) -> None:
        holder = self.build(pick_new)
        caller = self.build(post_process_locks_selector)
        holder.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": False,
                "locks.post-process.migration-rollout-rate": 0.0001,
            }
        ):
            assert caller._get_backend(self.key) is caller.backend_old
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

    def test_release_skips_new_when_check_is_off(self) -> None:
        backend = self.build(post_process_locks_selector)
        backend.backend_new.acquire(self.key, 10)
        backend.backend_old.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": False,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            backend.release(self.key)
        assert not backend.backend_old.locked(self.key)
        assert backend.backend_new.locked(self.key)

    def test_release_clears_new_when_check_is_on(self) -> None:
        backend = self.build(post_process_locks_selector)
        backend.backend_new.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            backend.release(self.key)
            assert not backend.locked(self.key)

    def test_release_with_check_on_at_rate_zero_does_not_touch_new(self) -> None:
        # The release on the old backend succeeds, so the release does not go to the
        # new backend. The copy on the new backend shows that it was not touched.
        backend = self.build(post_process_locks_selector)

        with override_options(
            {
                "locks.post-process.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            backend.acquire(self.key, 10)
            backend.backend_new.acquire(self.key, 10)
            backend.release(self.key)
        assert not backend.backend_old.locked(self.key)
        assert backend.backend_new.locked(self.key)

    def test_release_falls_back_when_picked_backend_is_unavailable(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": UnavailableLockBackend.path},
            backend_old_config=OLD_CONFIG,
            selector_func_path=pick_new,
        )
        backend.backend_old.acquire(self.key, 10)

        backend.release(self.key)
        assert not backend.backend_old.locked(self.key)

    def test_locked_skips_new_when_check_is_off(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": UnavailableLockBackend.path},
            backend_old_config=OLD_CONFIG,
            selector_func_path=post_process_locks_selector,
        )

        with override_options(
            {
                "locks.post-process.migration-check-new": False,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            assert not backend.locked(self.key)
            backend.backend_old.acquire(self.key, 10)
            assert backend.locked(self.key)

    def test_locked_reads_new_when_check_is_on(self) -> None:
        backend = self.build(post_process_locks_selector)
        backend.backend_new.acquire(self.key, 10)

        with override_options(
            {
                "locks.post-process.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            assert backend.locked(self.key)

    def test_release_with_check_off_raises_when_old_fails(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config=NEW_CONFIG,
            backend_old_config={"path": UnavailableLockBackend.path},
            selector_func_path=post_process_locks_selector,
        )

        with override_options(
            {
                "locks.post-process.migration-check-new": False,
                "locks.post-process.migration-rollout-rate": 0.0,
            }
        ):
            with pytest.raises(Exception):
                backend.release(self.key)

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

    def test_check_error_fails_open(self) -> None:
        backend = MigrationLockBackend(
            backend_new_config={"path": UnavailableLockBackend.path},
            backend_old_config=OLD_CONFIG,
            selector_func_path=pick_old,
        )

        backend.acquire(self.key, 10)
        assert backend.backend_old.locked(self.key)
        backend.release(self.key)
        assert not backend.backend_old.locked(self.key)


class TestRolloutSelectors(TestCase):
    new = DummyLockBackend()
    old = DummyLockBackend()
    keys = [f"key-{i}" for i in range(1000)]

    def picks(self, selector: SelectorFncType) -> list[LockBackend]:
        return [selector(key, self.new, self.old) for key in self.keys]

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

    def test_each_selector_reads_its_own_check_option(self) -> None:
        with override_options(
            {
                "locks.default.migration-rollout-rate": 0.0,
                "locks.default.migration-check-new": True,
                "locks.post-process.migration-rollout-rate": 0.0,
                "locks.post-process.migration-check-new": False,
            }
        ):
            assert default_locks_selector.check_new()
            assert not post_process_locks_selector.check_new()
