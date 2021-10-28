import _thread
from concurrent.futures import CancelledError, Future
from contextlib import contextmanager
from queue import Full
from threading import Event
from unittest import mock

import pytest

from sentry.utils.concurrent import (
    FutureSet,
    SynchronousExecutor,
    ThreadedExecutor,
    TimedFuture,
    execute,
)


def test_execute():
    assert execute(_thread.get_ident).result() != _thread.get_ident()

    with pytest.raises(Exception):
        assert execute(mock.Mock(side_effect=Exception("Boom!"))).result()


def test_future_set_callback_success():
    future_set = FutureSet([Future() for i in range(3)])

    callback = mock.Mock()
    future_set.add_done_callback(callback)

    for i, future in enumerate(list(future_set)):
        assert callback.call_count == 0
        future.set_result(True)

    assert callback.call_count == 1
    assert callback.call_args == mock.call(future_set)

    other_callback = mock.Mock()
    future_set.add_done_callback(other_callback)

    assert other_callback.call_count == 1
    assert other_callback.call_args == mock.call(future_set)


def test_future_set_callback_error():
    future_set = FutureSet([Future() for i in range(3)])

    callback = mock.Mock()
    future_set.add_done_callback(callback)

    for i, future in enumerate(list(future_set)):
        assert callback.call_count == 0
        future.set_exception(Exception)

    assert callback.call_count == 1
    assert callback.call_args == mock.call(future_set)

    other_callback = mock.Mock()
    future_set.add_done_callback(other_callback)

    assert other_callback.call_count == 1
    assert other_callback.call_args == mock.call(future_set)


def test_future_set_callback_empty():
    future_set = FutureSet([])

    callback = mock.Mock()
    future_set.add_done_callback(callback)

    assert callback.call_count == 1
    assert callback.call_args == mock.call(future_set)


def test_future_broken_callback():
    future_set = FutureSet([])

    callback = mock.Mock(side_effect=Exception("Boom!"))

    try:
        future_set.add_done_callback(callback)
    except Exception:
        assert False, "should not raise"

    assert callback.call_count == 1
    assert callback.call_args == mock.call(future_set)


@contextmanager
def timestamp(t):
    with mock.patch("sentry.utils.concurrent.time") as mock_time:
        mock_time.return_value = t
        yield


def test_timed_future_success():
    future = TimedFuture()
    assert future.get_timing() == (None, None)

    expected_result = mock.sentinel.RESULT_VALUE
    start_time, finish_time = expected_timing = (1.0, 2.0)

    callback_results = []
    callback = lambda future: callback_results.append((future.result(), future.get_timing()))

    future.add_done_callback(callback)

    with timestamp(start_time):
        future.set_running_or_notify_cancel()
        assert future.get_timing() == (start_time, None)

    assert len(callback_results) == 0

    with timestamp(finish_time):
        future.set_result(expected_result)
        assert future.get_timing() == expected_timing

    assert len(callback_results) == 1
    assert callback_results[0] == (expected_result, expected_timing)


def test_time_is_not_overwritten_if_fail_to_set_result():
    future = TimedFuture()

    with timestamp(1.0):
        future.set_running_or_notify_cancel()
        future.set_result(1)
        assert future.get_timing() == (1.0, 1.0)

    from concurrent.futures import InvalidStateError

    with timestamp(2.0):
        try:
            future.set_result(1)
        except InvalidStateError:
            pass
        # If set_result fails, the time shouldn't be overwritten.
        assert future.get_timing() == (1.0, 1.0)


def test_timed_future_error():
    future = TimedFuture()
    assert future.get_timing() == (None, None)

    start_time, finish_time = expected_timing = (1.0, 2.0)

    callback_timings = []
    callback = lambda future: callback_timings.append(future.get_timing())

    future.add_done_callback(callback)

    with timestamp(start_time):
        future.set_running_or_notify_cancel()
        assert future.get_timing() == (start_time, None)

    assert len(callback_timings) == 0

    with timestamp(finish_time):
        future.set_exception(None)
        assert future.get_timing() == expected_timing

    assert len(callback_timings) == 1
    assert callback_timings[0] == expected_timing


def test_timed_future_cancel():
    future = TimedFuture()
    assert future.get_timing() == (None, None)

    with timestamp(1.0):
        future.cancel()
        assert future.get_timing() == (None, 1.0)

    with timestamp(1.5):
        future.cancel()
        assert future.get_timing() == (None, 1.0)

    with timestamp(2.0):
        future.set_running_or_notify_cancel()
        assert future.get_timing() == (2.0, 1.0)

    with pytest.raises(RuntimeError):
        future.set_running_or_notify_cancel()

    assert future.get_timing() == (2.0, 1.0)


def test_synchronous_executor():
    executor = SynchronousExecutor()

    assert executor.submit(lambda: mock.sentinel.RESULT).result() is mock.sentinel.RESULT

    def callable():
        raise Exception(mock.sentinel.EXCEPTION)

    future = executor.submit(callable)
    try:
        future.result()
    except Exception as e:
        assert e.args[0] == mock.sentinel.EXCEPTION
    else:
        assert False, "expected future to raise"


def test_threaded_same_priority_Tasks():
    executor = ThreadedExecutor(worker_count=1)

    def callable():
        pass

    # Test that we can correctly submit multiple tasks
    executor.submit(callable)
    executor.submit(callable)


def test_threaded_executor():
    executor = ThreadedExecutor(worker_count=1, maxsize=3)

    def waiter(ready, waiting, result):
        ready.set()
        waiting.wait()
        return result

    initial_ready = Event()
    initial_waiting = Event()
    initial_future = executor.submit(
        lambda: waiter(initial_ready, initial_waiting, 1), block=True, timeout=1
    )

    # wait until the worker has removed this item from the queue
    assert initial_ready.wait(timeout=1), "waiter not ready"
    assert initial_future.running(), "waiter did not get marked as started"

    low_priority_ready = Event()
    low_priority_waiting = Event()
    low_priority_future = executor.submit(
        lambda: waiter(low_priority_ready, low_priority_waiting, 2),
        block=True,
        timeout=1,
        priority=10,
    )
    assert not low_priority_future.done(), "future should not be done (indicative of a full queue)"

    cancelled_future = executor.submit(lambda: None, block=True, timeout=1, priority=5)
    assert not cancelled_future.done(), "future should not be done (indicative of a full queue)"
    assert cancelled_future.cancel(), "future should be able to be cancelled"
    assert cancelled_future.done(), "future should be completed"
    with pytest.raises(CancelledError):
        cancelled_future.result()

    high_priority_ready = Event()
    high_priority_waiting = Event()
    high_priority_future = executor.submit(
        lambda: waiter(high_priority_ready, high_priority_waiting, 3),
        block=True,
        timeout=1,
        priority=0,
    )
    assert not high_priority_future.done(), "future should not be done (indicative of a full queue)"

    queue_full_future = executor.submit(lambda: None, block=False)
    assert queue_full_future.done()
    with pytest.raises(Full):
        queue_full_future.result()  # will not block if completed

    initial_waiting.set()  # let the task finish
    assert initial_future.result(timeout=1) == 1
    assert initial_future.done()

    assert high_priority_ready.wait(timeout=1)  # this should be the next task to execute
    assert high_priority_future.running()
    assert not low_priority_future.running()

    high_priority_waiting.set()  # let the task finish
    assert high_priority_future.result(timeout=1) == 3
    assert high_priority_future.done()

    assert low_priority_ready.wait(timeout=1)  # this should be the next task to execute
    assert low_priority_future.running()

    low_priority_waiting.set()  # let the task finish
    assert low_priority_future.result(timeout=1) == 2
    assert low_priority_future.done()
