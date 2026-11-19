class LockBackend:
    """
    Interface for providing lock behavior that is used by the
    ``sentry.utils.locking.Lock`` class.

    An override of ``acquire`` or ``release`` must accept ``token``. ``Lock``
    passes it on every call, and a backend that rejects the argument fails
    every acquire.
    """

    def acquire(self, key: str, duration: int, token: str | None = None) -> None:
        """
        Acquire a lock, represented by the given key for the given duration (in
        seconds.) This method should attempt to acquire the lock once, in a
        non-blocking fashion, allowing attempt retry policies to be defined
        separately.

        ``token`` is an optional fencing token written as the lock value. When
        omitted, the backend may use a process-wide default. A release must
        pass the same token to delete the key.

        The return value is not used. If the lock cannot be acquired, an
        exception should be raised.
        """
        raise NotImplementedError

    def release(self, key: str, token: str | None = None) -> None:
        """
        Release a lock. ``token`` must match the value written at acquire when
        a fencing token was used. The return value is not used.
        """
        raise NotImplementedError

    def locked(self, key: str) -> bool:
        """
        Check if a lock has been taken.
        """
        raise NotImplementedError
