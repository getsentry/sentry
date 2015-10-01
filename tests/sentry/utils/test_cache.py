from __future__ import absolute_import

import functools

import pytest

from sentry.testutils import TestCase
from sentry.utils.cache import (
    Lock,
    LockAlreadyHeld,
    UnableToGetLock,
)


class LockTestCase(TestCase):
    def test_basic(self):
        timeout = 10
        lock = Lock('basic', timeout=timeout)

        assert lock.held is False
        assert lock.seconds_remaining is 0

        assert lock.acquire() is True
        assert timeout > lock.seconds_remaining > (timeout - 0.1)
        assert lock.held is True

        with pytest.raises(LockAlreadyHeld):
            lock.acquire()

        assert lock.release() is True
        assert lock.seconds_remaining is 0
        assert lock.held is False
        assert lock.release() is False

    def test_context(self):
        timeout = 10
        lock = Lock('ctx', timeout=timeout)

        with lock as result:
            assert lock is result
            assert lock.held is True

        assert lock.held is False

    def test_concurrent(self):
        make_lock = functools.partial(Lock, 'concurrent')
        first = make_lock()
        second = make_lock(nowait=True)

        assert first.acquire() is True
        assert second.acquire() is False

        with pytest.raises(UnableToGetLock):
            with second:
                pass
