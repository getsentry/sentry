import contextlib
import time

import sentry_sdk
from django.db import connections

from sentry.utils import metrics


class AdvisoryLockAcquireTimeoutException(Exception):
    pass


class AdvisoryLockUnlockException(Exception):
    pass


def clean_up_advisory_lock(using: str, lock_id: int):
    """
    Only meant to be used by the `advisory_lock` decorator. This function will attempt
    to reset the state of the advisory lock with the given key, and will set the connection
    timeout to the specified time as well.
    :param using:
    :param lock_id:
    :return:
    """
    try:
        with connections[using].cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_id])

    except Exception:
        connections[using].close()
        sentry_sdk.capture_exception()
        raise


@contextlib.contextmanager
def advisory_lock(using: str, lock_id: int, lock_timeout_seconds: int, lock_metric_name: str):
    """
    Context manager used to acquire an advisory lock on the given lock ID. If
    the lock is held by another session, the context manager will reattempt to
    obtain the lock every second until the maximum duration provided in
    `lock_timeout_seconds` is reached.



    :param using: The database against which the lock is to be acquired.
    :param lock_id: An integer value representing a unique lock ID
    :param lock_timeout_seconds: The maximum amount of time in seconds to
    attempt acquiring the lock. Must be less than 30s.
    :param lock_metric_name:
    :return:
    """
    assert lock_timeout_seconds >= 1, "lock_timeout_seconds must be at least 1 second"
    assert lock_timeout_seconds <= 30, "lock_timeout_seconds must be less than 30 seconds"

    lock_acquired = False
    try:
        with metrics.timer(lock_metric_name), connections[using].cursor() as cursor:
            for i in range(lock_timeout_seconds + 1):
                cursor.execute("SELECT pg_try_advisory_lock(%s)", [lock_id])
                lock_acquired = cursor.fetchone()[0]
                if lock_acquired:
                    yield
                    return

                # Unable to acquire lock, so spin wait up until the maximum timeout
                if i < lock_timeout_seconds:
                    time.sleep(1)
            raise AdvisoryLockAcquireTimeoutException(
                f"Failed to acquire lock within {lock_timeout_seconds}s"
            )
    finally:
        if lock_acquired:
            clean_up_advisory_lock(
                using=using,
                lock_id=lock_id,
            )
