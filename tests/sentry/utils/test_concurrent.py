from __future__ import absolute_import

import mock
from concurrent.futures import Future
from sentry.utils.concurrent import FutureSet


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
