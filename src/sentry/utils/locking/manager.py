from sentry.utils import metrics
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.lock import Lock


class LockManager:
    def __init__(self, backend: LockBackend) -> None:
        self.backend = backend

    def get(
        self, key: str, duration: int, routing_key: str | None = None, name: str | None = None
    ) -> Lock:
        """
        Retrieve a ``Lock`` instance. This does not acquire the lock.

        :param key: Identifies the lock. Callers that use the same key contend
            for the same lock, so scope it to what it protects, for example
            ``f"my-feature:{project_id}"``.
        :param duration: Time in seconds after which the lock expires, even if
            it is still held. Set it longer than the worst-case runtime of the
            work it protects.
        :param routing_key: Passed to the backend to control where the lock is
            stored. Whether it has any effect depends on the backend.
        :param name: Only used as the ``lock_name`` tag on the
            ``lockmanager.get`` metric.
        """
        metrics.incr("lockmanager.get", tags={"lock_name": name} if name else None)
        return Lock(self.backend, key, duration, routing_key)
