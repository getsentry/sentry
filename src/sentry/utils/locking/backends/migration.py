from collections.abc import Callable
from typing import Optional, Union

from sentry import options
from sentry.conf.types.service_options import ServiceOptions
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.locking.backends import LockBackend
from sentry.utils.services import build_instance_from_options_of_type, resolve_callable

SelectorFncType = Callable[[str, Optional[Union[str, int]], LockBackend, LockBackend], LockBackend]


def _default_selector_func(
    key: str,
    routing_key: str | int | None,
    backend_new: LockBackend,
    backend_old: LockBackend,
) -> LockBackend:
    return backend_new


class RolloutRateSelector:
    """
    Sends a share of the keys, set by a runtime option, to the new backend.
    """

    def __init__(self, option_name: str) -> None:
        self.option_name = option_name

    def rate(self) -> float:
        return options.get(self.option_name)

    def __call__(
        self,
        key: str,
        routing_key: str | int | None,
        backend_new: LockBackend,
        backend_old: LockBackend,
    ) -> LockBackend:
        # Hash only the key, so that every process picks the same backend for a key
        bucket = int(md5_text(key).hexdigest()[:8], 16) % 10000
        if bucket < self.rate() * 10000:
            return backend_new
        return backend_old


default_locks_selector = RolloutRateSelector("locks.default.migration-rollout-rate")
post_process_locks_selector = RolloutRateSelector("locks.post-process.migration-rollout-rate")


class MigrationLockBackend(LockBackend):
    """
    Backend class intended for controlled migrations of locks from one backend to another.

    Example use with a rollout option:

        backend = MigrationLockBackend(
            backend_new_config={
                "path": "sentry.utils.locking.backends.redis.RedisClusterLockBackend",
                "options": {"cluster": "new-cluster"},
            },
            backend_old_config={
                "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
                "options": {"cluster": "old-cluster"},
            },
            selector_func_path="sentry.utils.locking.backends.migration.post_process_locks_selector",
        )

        locks = LockManager(backend)

    The selector sends a share of the keys, set by the
    `locks.post-process.migration-rollout-rate` option, to the new backend. The
    rate can go up at any time. While both backends are up, a lock is never given
    to two callers, even while processes read different option values.

    When the rate is 0, acquire does not read the new backend, so the new backend
    can be down or slow without effect on locks. But then locks that are still held
    on the new backend are not seen. To roll back, first lower the rate to a small
    value above 0 (for example 0.0001). Set it to 0 only after the longest lock
    duration plus the options cache time (about 70s) have passed.

    Each acquire also reads the other backend. If that read fails, the acquire
    still gives the lock (fail open). Locks keep working when the other backend
    is down, but two callers can then hold the same lock.
    """

    def __init__(
        self,
        backend_new_config: ServiceOptions,
        backend_old_config: ServiceOptions,
        selector_func_path: str | SelectorFncType | None = None,
    ):
        self.backend_new = build_instance_from_options_of_type(LockBackend, backend_new_config)
        self.backend_old = build_instance_from_options_of_type(LockBackend, backend_old_config)
        self.selector_func: SelectorFncType = (
            resolve_callable(selector_func_path) if selector_func_path else _default_selector_func
        )

    def _get_backend(self, key: str, routing_key: str | int | None) -> LockBackend:
        return self.selector_func(
            key,
            routing_key,
            self.backend_new,
            self.backend_old,
        )

    def _rollout_not_started(self, backend: LockBackend) -> bool:
        return (
            backend is self.backend_old
            and isinstance(self.selector_func, RolloutRateSelector)
            and self.selector_func.rate() == 0
        )

    def acquire(self, key: str, duration: int, routing_key: str | None = None) -> None:
        backend = self._get_backend(key=key, routing_key=routing_key)
        other = self.backend_new if backend is self.backend_old else self.backend_old

        backend.acquire(key=key, duration=duration, routing_key=routing_key)
        if self._rollout_not_started(backend):
            return
        try:
            held_elsewhere = other.locked(key=key, routing_key=routing_key)
        except Exception:
            metrics.incr("locks.migration.check_error")
            return

        if held_elsewhere:
            try:
                backend.release(key=key, routing_key=routing_key)
            except Exception:
                pass
            raise Exception(f"Could not set key: {key!r}")

    def release(self, key: str, routing_key: str | None = None) -> None:
        errors = []
        for backend in (self.backend_old, self.backend_new):
            try:
                backend.release(key=key, routing_key=routing_key)
            except Exception as e:
                errors.append(e)
        if len(errors) == 2:
            raise Exception(f"Could not release key: {key!r}: {errors!r}")

    def locked(self, key: str, routing_key: str | None = None) -> bool:
        return self.backend_old.locked(key=key, routing_key=routing_key) or self.backend_new.locked(
            key=key, routing_key=routing_key
        )
