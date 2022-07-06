from typing import Any, Callable, Mapping, Optional, Union, cast

from sentry.utils.locking.backends import LockBackend
from sentry.utils.services import build_instance_from_options, resolve_callable

SelectorFncType = Callable[[str, Optional[Union[str, int]], LockBackend, LockBackend], LockBackend]


def _default_selector_func(
    key: str,
    routing_key: Optional[Union[str, int]],
    backend_new: LockBackend,
    backend_old: LockBackend,
) -> LockBackend:
    return backend_new


class MigrationLockBackend(LockBackend):
    """
    Backend class intended for controlled migrations of locks from one backend to another.

    Example use in combination with runtime option:

        def selector_func(key, routing_key, backend_new, backend_old):
            if int(hashlib.md5("{key}{routing_key}".encode("utf8")).hexdigest(), 16) % 100 <= options.get(
                "migrate.locks", 0
            ):
                return backend_old
            return backend_new


        backend = MigrationLockBackend(
            backend_new_config={
                "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
                "options": {"cluster": "new-cluster"},
            },
            backend_old_config={
                "path": "sentry.utils.locking.backends.redis.RedisLockBackend",
                "options": {"cluster": "old-cluster"},
            },
            selector_func_path="python.path.to.selector_func",
        )

        locks = LockManager(backend)


    This example setup allows to move portion of keys, based on the value
    of the runtime option, to use the new Redis cluster or revert to the old
    one.

    """

    def __init__(
        self,
        backend_new_config: Mapping[str, Any],
        backend_old_config: Mapping[str, Any],
        selector_func_path: Optional[Union[str, SelectorFncType]] = None,
    ):
        self.backend_new = cast(LockBackend, build_instance_from_options(backend_new_config))
        self.backend_old = cast(LockBackend, build_instance_from_options(backend_old_config))
        self.selector_func: SelectorFncType = (
            cast(SelectorFncType, resolve_callable(selector_func_path))
            if selector_func_path
            else _default_selector_func
        )

    def _get_backend(self, key: str, routing_key: Optional[Union[str, int]]) -> LockBackend:
        return self.selector_func(
            key,
            routing_key,
            self.backend_new,
            self.backend_old,
        )

    def acquire(self, key: str, duration: int, routing_key: Optional[str] = None) -> None:
        backend = self._get_backend(key=key, routing_key=routing_key)
        # in case new backend is selected for the key, make sure it's not held
        # by the old backend
        if backend != self.backend_old and self.backend_old.locked(
            key=key, routing_key=routing_key
        ):
            raise Exception(f"Could not set key: {key!r}")
        return backend.acquire(key=key, duration=duration, routing_key=routing_key)

    def release(self, key, routing_key=None):
        backend = self._get_backend(key=key, routing_key=routing_key)
        try:
            (self.backend_new if backend == self.backend_old else self.backend_old).release(
                key=key, routing_key=routing_key
            )
        except Exception:
            pass
        backend.release(key=key, routing_key=routing_key)

    def locked(self, key, routing_key=None):
        return self.backend_old.locked(key=key, routing_key=routing_key) or self.backend_new.locked(
            key=key, routing_key=routing_key
        )
