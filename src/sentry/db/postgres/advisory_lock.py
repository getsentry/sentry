import contextlib
import logging
import threading

import sentry_sdk
from django.db import connections

from sentry.utils import metrics


@contextlib.contextmanager
def advisory_lock(using: str, lock_id: int, lock_timeout_seconds: int, lock_metric_name: str):
    lock_acquired = False
    # Obtain the previously set lock timeout, so we can reset it after unlocking.
    with connections[using].cursor() as cursor:
        cursor.execute("show lock_timeout")
        orig_timeout = cursor.fetchone()[0]
        cursor.execute(f"SET local lock_timeout='{lock_timeout_seconds}s'")

    try:
        with metrics.timer(lock_metric_name), connections[using].cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [lock_id])

        lock_acquired = True
        logging.info(
            "advisory_lock_%s_acquired",
            lock_metric_name,
            extra={"lock_id": lock_id, "thread_id": threading.get_ident()},
        )
        yield
    finally:
        if lock_acquired:
            try:
                with connections[using].cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s)", [lock_id])
                    cursor.execute(f"SET lock_timeout='{orig_timeout}'")

                logging.info(
                    "advisory_lock_%s_released",
                    lock_metric_name,
                    extra={"lock_id": lock_id, "thread_id": threading.get_ident()},
                )
            except Exception:
                logging.info(
                    "advisory_lock_%s_connection_terminated",
                    lock_metric_name,
                    extra={"lock_id": lock_id, "thread_id": threading.get_ident()},
                )
                connections[using].close()
                sentry_sdk.capture_exception()
                raise
