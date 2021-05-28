import unittest
from unittest.mock import patch

import pytest

from sentry.utils.compat import mock
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

    @patch("sentry.utils.locking.lock.Lock.acquire", side_effect=UnableToAcquireLock)
    def test_blocking_aqcuire(self, mock_acquire):
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        with self.assertRaises(UnableToAcquireLock):
            lock.blocking_acquire(interval=0, max_attempts=3)

        assert len(mock_acquire.mock_calls) == 3

        # Success case:
        mock_acquire.return_value = "foo"
        mock_acquire.side_effect = None
        assert lock.blocking_acquire(interval=1, max_attempts=1) == "foo"
