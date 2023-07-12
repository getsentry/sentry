import time

from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.task_context import TaskContext


def test_task_context_expiration_time():
    """
    Tests that the TaskContext properly initialises the expiration_time
    """
    with freeze_time("2023-07-12 10:00:00"):
        context = TaskContext("my-task", 3)
        # expiration should be 3 seconds from now
        assert context.expiration_time == time.monotonic() + 3


def test_task_context_data():
    """
    Tests that TaskContext properly handles function contexts

    * it deals with defaults and missing values
    * it sets and retrieves values correctly
    * it keeps various function contexts separated from each other
    """
    context = TaskContext("my-task", 3)
    assert context.get_current_context("func1") is None
    assert context.get_current_context("func1", {"key": "default-value"}) == {
        "key": "default-value"
    }
    context.set_current_context("func1", 2.2, {"key": "some-value"})
    assert context.get_current_context("func1") == {
        "executionTime": 2.2,
        "data": {"key": "some-value"},
    }
    assert context.get_current_context("func1", {"key": "default-value"}) == {
        "executionTime": 2.2,
        "data": {"key": "some-value"},
    }
    assert context.get_current_context("func2") is None
    assert context.get_current_context("func2", {"key": "default-value"}) == {
        "key": "default-value"
    }
