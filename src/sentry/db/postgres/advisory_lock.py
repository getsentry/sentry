import contextlib

from django.db import connections

from sentry.utils import metrics


@contextlib.contextmanager
def advisory_lock(using: str, lock_id: int, lock_timeout_seconds: int, lock_metric_name: str):
    # Obtain the previously set lock timeout, so we can reset it after unlocking.
    with connections[using].cursor() as cursor:
        cursor.execute("show lock_timeout")
        orig_timeout = cursor.fetchone()[0]
        cursor.execute(f"SET local lock_timeout='{lock_timeout_seconds}s'")

    try:
        with metrics.timer(lock_metric_name), connections[using].cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [lock_id])
        yield
    finally:
        try:
            with connections[using].cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_id])
                cursor.execute(f"SET lock_timeout='{orig_timeout}'")
        except Exception:
            # If unlocking fails for any reason, close the connection in order to free the lock.
            connections[using].close()
