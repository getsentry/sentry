from __future__ import absolute_import

import mock
import pytest

from sentry.testutils import TestCase
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.lock import Lock


class LockTestCase(TestCase):
    def test_procedural_interface(self):
        backend = mock.Mock(spec=LockBackend)
        key = 'lock'
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        lock.acquire()
        backend.acquire.assert_called_once_with(
            key,
            duration,
            routing_key,
        )

        lock.release()
        backend.release.assert_called_once_with(
            key,
            routing_key,
        )

        backend.acquire.side_effect = Exception('Boom!')
        with pytest.raises(UnableToAcquireLock):
            lock.acquire()

    def test_context_manager_interface(self):
        backend = mock.Mock(spec=LockBackend)
        key = 'lock'
        duration = 60
        routing_key = None

        lock = Lock(backend, key, duration, routing_key)

        with lock.acquire():
            backend.acquire.assert_called_once_with(
                key,
                duration,
                routing_key,
            )

        backend.release.assert_called_once_with(
            key,
            routing_key,
        )
