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

    A second option controls whether MigrationLockBackend checks the new backend
    for keys that go to the old backend. See MigrationLockBackend for the order in
    which to change the two options.
    """

    def __init__(self, rate_option: str, check_new_option: str) -> None:
        self.rate_option = rate_option
        self.check_new_option = check_new_option

    def rate(self) -> float:
        return options.get(self.rate_option)

    def check_new(self) -> bool:
        return self.rate() > 0 or options.get(self.check_new_option)

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


default_locks_selector = RolloutRateSelector(
    "locks.default.migration-rollout-rate", "locks.default.migration-check-new"
)
post_process_locks_selector = RolloutRateSelector(
    "locks.post-process.migration-rollout-rate", "locks.post-process.migration-check-new"
)


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

    Acquire takes the lock on the backend that the selector picks, then checks the
    other backend and backs off if the lock is held there. Keys that go to the new
    backend always check the old backend. Keys that go to the old backend check the
    new backend only when the selector's `check_new()` is true, and release and
    locked also skip the new backend when it is false. This lets the new backend be down or
    slow without effect on locks before the rollout starts and after a rollback.

    Two options control a rollout with `post_process_locks_selector` (the
    `locks.default.*` options do the same for `default_locks_selector`):

    - `locks.post-process.migration-check-new`: check the new backend for keys that
      go to the old backend.
    - `locks.post-process.migration-rollout-rate`: share of keys (0.0 to 1.0) that
      go to the new backend. A rate above 0 also turns on the check.

    Each process caches option values for up to about 70s (a 10s TTL, plus a 60s
    grace time when the options store has errors). While a change spreads,
    processes read different values. The sequence below makes sure that while any
    process can put a lock on the new backend, all processes check the new backend.

    Rollout:

    1. Deploy this config with the check off and the rate at 0. All keys go to the
       old backend, and acquire, release, and locked do not read the new backend.
    2. Turn on the check. Wait at least 70s, so that all processes see it. Do not
       raise the rate before then: a process that still reads the check as off and
       the rate as 0 does not see locks on the new backend, and can give a lock
       that a process with the new rate already holds there.
    3. Raise the rate in steps, as fast or slow as you like. The check is on
       everywhere, so a lock is never given to two callers while processes read
       different rates.
    4. At rate 1.0, all new locks go to the new backend. Before you change the
       config to use the new backend alone, wait the longest lock duration plus 70s,
       so that all locks on the old backend have expired.

    Rollback:

    1. Lower the rate, to 0 if necessary. Keep the check on. Processes that still
       read the old rate and put locks on the new backend stay safe, because all
       processes check the new backend.
    2. Wait the longest lock duration of this lock manager plus 70s, so that all
       locks on the new backend expire. For post-process locks the longest lock is
       600s, so wait about 11 minutes.
    3. Turn off the check. From then on, acquire, release, and locked do not use the
       new backend.

    While the check is on, a new backend that is slow makes each acquire, release,
    and locked call slow, also after a rollback, until the check is off.

    If the read of the other backend fails, the acquire still gives the lock (fail
    open). Locks keep working when the other backend is down, but two callers can
    then hold the same lock.
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

    def _uses_new(self) -> bool:
        if isinstance(self.selector_func, RolloutRateSelector):
            return self.selector_func.check_new()
        return True

    def acquire(self, key: str, duration: int, routing_key: str | None = None) -> None:
        backend = self._get_backend(key=key, routing_key=routing_key)
        other = self.backend_new if backend is self.backend_old else self.backend_old

        backend.acquire(key=key, duration=duration, routing_key=routing_key)
        if backend is self.backend_old and not self._uses_new():
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
        # Release on both backends, because the selector can have picked a different
        # backend at acquire time than it picks now (the rate changed, or this process
        # read a different option value).
        backends = (self.backend_old, self.backend_new) if self._uses_new() else (self.backend_old,)
        errors = []
        for backend in backends:
            try:
                backend.release(key=key, routing_key=routing_key)
            except Exception as e:
                errors.append(e)
        if len(errors) == len(backends):
            raise Exception(f"Could not release key: {key!r}: {errors!r}")

    def locked(self, key: str, routing_key: str | None = None) -> bool:
        if self.backend_old.locked(key=key, routing_key=routing_key):
            return True
        if not self._uses_new():
            return False
        return self.backend_new.locked(key=key, routing_key=routing_key)
