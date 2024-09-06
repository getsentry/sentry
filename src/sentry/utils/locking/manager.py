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
        Retrieve a ``Lock`` instance.
        """
        metrics.incr("lockmanager.get", tags={"lock_name": name} if name else None)
        return Lock(self.backend, key, duration, routing_key)
