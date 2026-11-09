from redis.exceptions import ResponseError


class UnableToAcquireLock(Exception):
    """Exception raised when a lock cannot be acquired."""


class LockNotOwned(ResponseError):
    """Raised when a release does not own the lock key.

    Redis delete_lock.lua replies ``NOLOCK`` when the key is gone, and
    ``LOCKHELD`` when a different token owns it. A connection failure is
    not this error: the caller may still own the key and can retry.

    This subclasses ``ResponseError`` and keeps that reply text. Callers that
    catch ``RedisError`` and treat a ``NOLOCK`` or ``LOCKHELD`` message as a
    finished release keep doing so.
    """
