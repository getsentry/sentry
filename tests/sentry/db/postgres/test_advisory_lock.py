import functools
import threading
import time
from collections.abc import Callable
from typing import Any, Optional

import pytest
from django.db import connections, transaction

from sentry.db.postgres.advisory_lock import (
    AdvisoryLockAcquireTimeoutException,
    advisory_lock,
    clean_up_advisory_lock,
)
from sentry.testutils.cases import TestCase

advisory_lock_key = 1234


def acquire_advisory_lock_with_barrier(
    lock_key: int,
    lock_timeout: int,
    entry_barrier: threading.Barrier | None = None,
    exit_barrier: threading.Barrier | None = None,
):
    with advisory_lock(
        using="default",
        lock_id=lock_key,
        lock_timeout_seconds=lock_timeout,
        lock_metric_name="advisory_lock_test",
    ):
        if entry_barrier is not None:
            entry_barrier.wait()

        if exit_barrier is not None:
            exit_barrier.wait()


def wait_until_barrier_hit(
    barrier: threading.Barrier, min_waiters: int, maximum_timeout_seconds: int
):
    for i in range(maximum_timeout_seconds):
        if barrier.n_waiting >= min_waiters:
            return

        time.sleep(1)

    raise Exception("Maximum wait time exceeded for barrier to be reached by parties")


def wrap_with_connection_closure(c: Callable[..., Any]) -> Callable[..., Any]:
    def wrapper(*args: Any, **kwds: Any) -> Any:
        try:
            return c(*args, **kwds)
        finally:
            for connection in connections.all():
                connection.close()

    functools.update_wrapper(wrapper, c)
    return wrapper


def get_advisory_lock_thread(
    lock_key: int,
    lock_timeout: int,
    entry_barrier: threading.Barrier,
    exit_barrier: threading.Barrier,
) -> threading.Thread:
    return threading.Thread(
        target=wrap_with_connection_closure(
            lambda: acquire_advisory_lock_with_barrier(
                lock_key=lock_key,
                entry_barrier=entry_barrier,
                exit_barrier=exit_barrier,
                lock_timeout=lock_timeout,
            )
        )
    )


class TestAdvisoryLock(TestCase):
    def setUp(self):
        self.original_lock_timeout = "30s"
        with connections["default"].cursor() as cursor:
            cursor.execute(f"SET lock_timeout='{self.original_lock_timeout}'")

    def test_lock_and_unlock_happy_path(self):
        with advisory_lock(
            using="default",
            lock_id=advisory_lock_key,
            lock_timeout_seconds=1,
            lock_metric_name="advisory_lock",
        ):
            pass

    def test_lock_timeout(self):
        barrier = threading.Barrier(timeout=100, parties=2)
        lock_thread = get_advisory_lock_thread(
            lock_key=advisory_lock_key, lock_timeout=1, entry_barrier=barrier, exit_barrier=barrier
        )

        lock_thread.start()
        barrier.wait()
        with pytest.raises(AdvisoryLockAcquireTimeoutException):
            with transaction.atomic(using="default"):
                acquire_advisory_lock_with_barrier(lock_key=advisory_lock_key, lock_timeout=1)

        # This doesn't completely test the cleanup code, as the transaction handling will
        # rollback the timeout we set in the advisory lock code.
        barrier.wait()
        lock_thread.join(timeout=10)

        acquire_advisory_lock_with_barrier(lock_key=advisory_lock_key, lock_timeout=1)

    def test_lock_contention(self):
        # barrier = threading.Barrier(timeout=10, parties=2)
        entry_barrier = threading.Barrier(parties=2, timeout=5)
        exit_barrier = threading.Barrier(parties=2, timeout=5)
        original_lock_thread = get_advisory_lock_thread(
            lock_key=advisory_lock_key,
            lock_timeout=10,
            entry_barrier=entry_barrier,
            exit_barrier=exit_barrier,
        )
        contentious_lock_thread = get_advisory_lock_thread(
            lock_key=advisory_lock_key,
            lock_timeout=10,
            entry_barrier=entry_barrier,
            exit_barrier=exit_barrier,
        )

        # Start the initial thread, block on the exit barrier and ensure the thread has reached it
        original_lock_thread.start()
        entry_barrier.wait()
        wait_until_barrier_hit(exit_barrier, 1, 2)

        # Start the contentious thread, ensure the lock is inaccessible given the timeout
        contentious_lock_thread.start()
        with pytest.raises(AdvisoryLockAcquireTimeoutException):
            acquire_advisory_lock_with_barrier(lock_key=advisory_lock_key, lock_timeout=1)

        assert contentious_lock_thread.is_alive(), "Contentious thread has died"
        assert (
            entry_barrier.n_waiting == 0
        ), "Entry barrier should not have any parties awaiting due to lock"

        # Release the initial thread to finish its execution and release the lock
        exit_barrier.wait()

        # Assert contentious thread has encountered the barrier
        wait_until_barrier_hit(entry_barrier, 1, 5)
        entry_barrier.wait()
        exit_barrier.wait()
        original_lock_thread.join(timeout=1)
        contentious_lock_thread.join(timeout=1)

    def test_lock_with_exception(self):
        # It pops, locks, and crashes. Lock should be unlocked.
        # The original exception should be thrown.
        exception_message = "An exception occurred in the locked region"
        with pytest.raises(Exception) as e:
            with advisory_lock(
                using="default",
                lock_id=advisory_lock_key,
                lock_timeout_seconds=1,
                lock_metric_name="advisory_lock",
            ):
                raise Exception(exception_message)

        assert exception_message in str(e)

        acquire_advisory_lock_with_barrier(lock_key=advisory_lock_key, lock_timeout=1)

    def test_nested_lock(self):
        # It locks, it locks again without error, it unlocks the lock in the inner context, it noops on the outer lock.
        with advisory_lock(
            using="default",
            lock_id=advisory_lock_key,
            lock_timeout_seconds=1,
            lock_metric_name="advisory_lock",
        ):
            with advisory_lock(
                using="default",
                lock_id=advisory_lock_key,
                lock_timeout_seconds=1,
                lock_metric_name="advisory_lock",
            ):
                pass


class TestCleanUpAdvisoryLock(TestCase):
    def test_cleanup_without_lock_held(self):
        clean_up_advisory_lock(using="default", lock_id=1234)
