class UnableToAcquireLock(Exception):
    """Exception raised when a lock cannot be acquired."""


class LockNotOwned(Exception):
    """Raised when a release does not own the lock key.

    Redis delete_lock.lua replies ``NOLOCK`` when the key is gone, and
    ``LOCKHELD`` when a different token owns it. A connection failure is
    not this error: the caller may still own the key and can retry.
    """
