from sentry.utils import metrics
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.lock import Lock


class LockManager:
    def __init__(self, backend: LockBackend) -> None:
        self.backend = backend

    def get(
        self,
        key: str,
        duration: int,
        name: str | None = None,
        metrics_sample_rate: float | None = None,
    ) -> Lock:
        """
        Retrieve a ``Lock`` instance.

        ``metrics_sample_rate`` sets the sample rate of the ``locks.*`` metrics
        of a named lock. Leave it unset for the default rate.
        """
        metrics.incr("lockmanager.get", tags={"lock_name": name} if name else None)
        return Lock(self.backend, key, duration, name=name, metrics_sample_rate=metrics_sample_rate)
