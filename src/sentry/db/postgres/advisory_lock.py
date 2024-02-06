import contextlib
import logging
import threading
from typing import Optional

import sentry_sdk
from django.db import OperationalError, connections

from sentry.utils import metrics

logger = logging.getLogger("advisory_lock_logger")


class AdvisoryLockAcquireTimeoutException(Exception):
    pass


class AdvisoryLockUnlockException(Exception):
    pass


def clean_up_advisory_lock(
    lock_acquired: bool, using: str, lock_id: int, original_lock_timeout: Optional[str]
):
    """
    Only meant to be used by the `advisory_lock` decorator. This function will attempt
    to reset the state of the advisory lock with the given key, and will set the connection
    timeout to the specified time as well.
    :param lock_acquired:
    :param using:
    :param lock_id:
    :param original_lock_timeout:
    :return:
    """
    try:
        with connections[using].cursor() as cursor:
            if lock_acquired:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_id])
                # While it's not ideal to keep the lock timeout reset tied to lock
                # acquisition, it makes testing this functionality possible.
                # Since this is only used for explicit locking, we should be ok.
                cursor.execute("SET lock_timeout=%s", [original_lock_timeout])

    except Exception:
        connections[using].close()
        sentry_sdk.capture_exception()
        raise


@contextlib.contextmanager
def advisory_lock(using: str, lock_id: int, lock_timeout_seconds: int, lock_metric_name: str):
    assert lock_timeout_seconds >= 1, "lock_timeout_seconds must be at least 1 second"

    lock_acquired = False
    with connections[using].cursor() as cursor:
        cursor.execute("show lock_timeout")
        # Obtain the previously set lock timeout, so we can reset it after unlocking.
        # This is returned as a string with the units included (E.x. "5s")
        orig_timeout = cursor.fetchone()[0]
        cursor.execute(f"SET local lock_timeout='{lock_timeout_seconds}s'")

    try:
        with metrics.timer(lock_metric_name), connections[using].cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [lock_id])
            result = cursor.fetchone()[0]

            lock_acquired = True
            logger.info(
                "lock_acquired",
                extra={
                    "lock_id": lock_id,
                    "thread_id": threading.get_ident(),
                    "result": result,
                    "connection_id": connections[using],
                },
            )
            yield
    except OperationalError as e:
        if "LockNotAvailable" in str(e):
            raise AdvisoryLockAcquireTimeoutException() from e
        raise
    finally:
        clean_up_advisory_lock(
            lock_acquired=lock_acquired,
            using=using,
            lock_id=lock_id,
            original_lock_timeout=orig_timeout,
        )
