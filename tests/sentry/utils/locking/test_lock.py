import unittest
from unittest import mock
from unittest.mock import MagicMock, call, patch

import pytest

from sentry.utils.locking import LockHeld, LockNotOwned, UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend
from sentry.utils.locking.lock import Lock


class LockTestCase(unittest.TestCase):
    def test_procedural_interface(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60

        lock = Lock(backend, key, duration)

        lock.acquire()
        acquired = lock.token
        assert acquired is not None
        backend.acquire.assert_called_once_with(key, duration, acquired)

        lock.locked()
        backend.locked.assert_called_once_with(key)

        backend.acquire.side_effect = Exception("Boom!")
        with pytest.raises(UnableToAcquireLock):
            lock.acquire()
        # A direct assert on lock.token would narrow it to str for the rest of
        # the test, so the later check that release cleared it is unreachable.
        held = lock.token
        assert held == acquired
        backend.acquire.side_effect = None

        lock.release()
        backend.release.assert_called_once_with(key, acquired)
        assert lock.token is None

        lock.release()
        backend.release.assert_called_once_with(key, acquired)

    def test_context_manager_interface(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60

        lock = Lock(backend, key, duration)

        with lock.acquire():
            token = lock.token
            backend.acquire.assert_called_once_with(key, duration, token)
            assert token is not None

        backend.release.assert_called_once_with(key, token)
        assert lock.token is None

    def test_release_without_acquire_does_not_call_backend(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        Lock(backend, "lock", 60).release()
        backend.release.assert_not_called()

    def test_release_swallows_lock_not_owned(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        lock = Lock(backend, "lock", 60)
        lock.token = "holder"
        backend.release.side_effect = LockNotOwned("NOLOCK No lock at key exists at key: x")

        lock.release()

        backend.release.assert_called_once_with("lock", "holder")
        # The release did not succeed, so a retry still has the token to send.
        assert lock.token == "holder"

    def test_each_acquire_uses_a_fresh_token(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        lock = Lock(backend, "lock", 60)

        lock.acquire()
        first = lock.token
        lock.release()
        lock.acquire()
        second = lock.token

        assert first is not None
        assert second is not None
        assert first != second
        assert backend.acquire.call_args_list == [
            call("lock", 60, first),
            call("lock", 60, second),
        ]
        assert backend.release.call_args_list == [
            call("lock", first),
        ]

    @patch("sentry.utils.locking.lock.random.random", return_value=0.5)
    @patch("sentry.utils.locking.lock.Lock.acquire", side_effect=UnableToAcquireLock)
    def test_blocking_acquire(self, mock_acquire: MagicMock, mock_random: MagicMock) -> None:
        backend = mock.Mock(spec=LockBackend)
        key = "lock"
        duration = 60

        lock = Lock(backend, key, duration)

        class MockTime:
            time: float = 0

            @classmethod
            def incr(cls, delta: float) -> None:
                cls.time += delta

        with (
            patch("sentry.utils.locking.lock.time.monotonic", side_effect=lambda: MockTime.time),
            patch("sentry.utils.locking.lock.time.sleep", side_effect=MockTime.incr) as mock_sleep,
        ):
            with pytest.raises(UnableToAcquireLock):
                lock.blocking_acquire(initial_delay=0.1, timeout=1, exp_base=2)

            # 0.0, 0.05, 0.15, 0.35, 0.75, then the last attempt at 1.0
            assert len(mock_acquire.mock_calls) == 6
            assert mock_sleep.mock_calls == [
                call(0.05),
                call(0.1),
                call(0.2),
                call(0.4),
                call(pytest.approx(0.25)),
            ]

        with patch("sentry.utils.locking.lock.Lock.acquire", return_value="foo"):
            # Success case:
            result: object = lock.blocking_acquire(initial_delay=0, timeout=1)
            assert result == "foo"

    def test_acquire_raises_lock_held_only_for_contention(self) -> None:
        backend = mock.Mock(spec=LockBackend)
        lock = Lock(backend, "lock", 60)

        backend.acquire.side_effect = LockHeld("Could not set key")
        with pytest.raises(LockHeld):
            lock.acquire()

        backend.acquire.side_effect = Exception("redis down")
        with pytest.raises(UnableToAcquireLock) as raised:
            lock.acquire()
        assert not isinstance(raised.value, LockHeld)

    @patch("sentry.utils.locking.lock.random.random", return_value=1.0)
    @patch("sentry.utils.locking.lock.Lock.acquire", side_effect=LockHeld)
    def test_blocking_acquire_caps_the_delay(
        self, mock_acquire: MagicMock, mock_random: MagicMock
    ) -> None:
        lock = Lock(mock.Mock(spec=LockBackend), "lock", 60)

        # The clock never moves, as under freeze_time. The time slept still
        # reaches the deadline.
        with (
            patch("sentry.utils.locking.lock.time.monotonic", return_value=0.0),
            patch("sentry.utils.locking.lock.time.sleep") as mock_sleep,
            pytest.raises(UnableToAcquireLock),
        ):
            lock.blocking_acquire(initial_delay=0.25, timeout=1.5, exp_base=2, max_delay=0.5)

        assert mock_sleep.mock_calls == [call(0.25), call(0.5), call(0.5), call(0.25)]
        assert len(mock_acquire.mock_calls) == 5

    @patch("sentry.utils.locking.lock.Lock.acquire", side_effect=UnableToAcquireLock)
    def test_blocking_acquire_can_raise_backend_errors_without_retrying(
        self, mock_acquire: MagicMock
    ) -> None:
        lock = Lock(mock.Mock(spec=LockBackend), "lock", 60)

        with (
            patch("sentry.utils.locking.lock.time.sleep") as mock_sleep,
            pytest.raises(UnableToAcquireLock) as raised,
        ):
            lock.blocking_acquire(initial_delay=0.1, timeout=1, retry_backend_errors=False)

        assert not isinstance(raised.value, LockHeld)
        assert len(mock_acquire.mock_calls) == 1
        mock_sleep.assert_not_called()
