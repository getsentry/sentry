from __future__ import absolute_import

import mock
import pytest
from Queue import Full
from concurrent.futures import Future
from threading import Event

from sentry.utils.concurrent import FutureSet, ThreadedExecutor


def test_future_set_callback_success():
    future_set = FutureSet([Future() for i in xrange(3)])

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
    future_set = FutureSet([Future() for i in xrange(3)])

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

    callback = mock.Mock(side_effect=Exception('Boom!'))

    try:
        future_set.add_done_callback(callback)
    except Exception:
        assert False, 'should not raise'

    assert callback.call_count == 1
    assert callback.call_args == mock.call(future_set)


def test_threaded_executor():
    executor = ThreadedExecutor(worker_count=1, maxsize=2)

    def waiter(ready, waiting, result):
        ready.set()
        waiting.wait()
        return result

    initial_ready = Event()
    initial_waiting = Event()
    initial_future = executor.submit(
        lambda: waiter(initial_ready, initial_waiting, 1),
        block=True,
    )

    initial_ready.wait()  # wait until the worker has removed this item from the queue
    assert initial_future.running()

    low_priority_ready = Event()
    low_priority_waiting = Event()
    low_priority_future = executor.submit(
        lambda: waiter(low_priority_ready, low_priority_waiting, 2),
        block=True,
        priority=10,
    )

    high_priority_ready = Event()
    high_priority_waiting = Event()
    high_priority_future = executor.submit(
        lambda: waiter(high_priority_ready, high_priority_waiting, 3),
        block=True,
        priority=0,
    )

    queue_full_future = executor.submit(lambda: None, block=False)
    with pytest.raises(Full):
        queue_full_future.result()

    initial_waiting.set()  # let the task finish
    assert initial_future.result() is 1
    assert initial_future.done()

    assert high_priority_ready.wait(timeout=1)  # this should be the next task to execute
    assert high_priority_future.running()
    assert not low_priority_future.running()

    high_priority_waiting.set()  # let the task finish
    assert high_priority_future.result() is 3
    assert high_priority_future.done()

    assert low_priority_ready.wait(timeout=1)  # this should be the next task to execute
    assert low_priority_future.running()

    low_priority_waiting.set()  # let the task finish
    assert low_priority_future.result() is 2
    assert low_priority_future.done()
