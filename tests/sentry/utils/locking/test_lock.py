import unittest
from unittest import mock
from unittest.mock import call, patch

import pytest

from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.lock import Lock


class LockTestCase(unittest.TestCase):
    def test_procedural_interface(self):
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        lock.acquire()
        backend.acquire.assert_called_once_with(key, duration, routing_key)

        lock.locked()
        backend.locked.assert_called_once_with(key, routing_key)

        lock.release()
        backend.release.assert_called_once_with(key, routing_key)

        backend.acquire.side_effect = Exception("Boom!")
        with pytest.raises(UnableToAcquireLock):
            lock.acquire()

    def test_context_manager_interface(self):
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        with lock.acquire():
            backend.acquire.assert_called_once_with(key, duration, routing_key)

        backend.release.assert_called_once_with(key, routing_key)

    @patch("sentry.utils.locking.lock.random.random", return_value=0.5)
    @patch("sentry.utils.locking.lock.Lock.acquire", side_effect=UnableToAcquireLock)
    def test_blocking_acquire(self, mock_acquire, mock_random):
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        class MockTime:
            time = 0

            @classmethod
            def incr(cls, delta):
                cls.time += delta

        with (
            patch("sentry.utils.locking.lock.time.monotonic", side_effect=lambda: MockTime.time),
            patch("sentry.utils.locking.lock.time.sleep", side_effect=MockTime.incr) as mock_sleep,
        ):
            with pytest.raises(UnableToAcquireLock):
                lock.blocking_acquire(initial_delay=0.1, timeout=1, exp_base=2)

            # 0.0, 0.05, 0.15, 0.35, 0.75
            assert len(mock_acquire.mock_calls) == 5
            assert mock_sleep.mock_calls == [call(0.05), call(0.1), call(0.2), call(0.4)]

        with patch("sentry.utils.locking.lock.Lock.acquire", return_value="foo"):
            # Success case:
            assert lock.blocking_acquire(initial_delay=0, timeout=1) == "foo"
