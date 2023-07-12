from datetime import timedelta

import pytest
from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.common import TimedIterator, TimeoutException
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.utils.types import Any


def test_timeout_exception():
    """
    Test creation of exception
    """

    context = TaskContext("my_context", 3)
    # test we can create an exception (with additional args)
    ex = TimeoutException(context, 23)
    assert ex.task_context == context
    ex = TimeoutException(task_context=context)
    assert ex.task_context == context


class FakeContextIterator:
    def __init__(self, frozen_time: Any, tick_seconds):
        self.count = 0
        self.frozen_time = frozen_time
        self.tick_seconds = tick_seconds

    def __iter__(self):
        return self

    def __next__(self):
        if self.count < 2:
            self.count += 1
            self.frozen_time.tick(delta=timedelta(seconds=self.tick_seconds))
            return self.count
        raise StopIteration()

    def get_current_state(self):
        return self.count


def test_timed_iterator_no_timout():

    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, "ti1", FakeContextIterator(frozen_time, 1))
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_current_context("ti1") == {"data": 1, "executionTime": 1}
        assert (next(it)) == 2
        assert context.get_current_context("ti1") == {"data": 2, "executionTime": 2}
        with pytest.raises(StopIteration):
            next(it)


def test_timed_iterator_with_timeout():
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        context = TaskContext("my_context", 3)
        it = TimedIterator(context, "ti1", FakeContextIterator(frozen_time, 4))
        # should iterate while there is no timeout
        assert (next(it)) == 1
        assert context.get_current_context("ti1") == {"data": 1, "executionTime": 4.0}
        # the next iteration will be at 4 seconds which is over time and should raise
        with pytest.raises(TimeoutException):
            next(it)
