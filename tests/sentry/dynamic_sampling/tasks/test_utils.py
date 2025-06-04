import pytest

from sentry.dynamic_sampling.tasks.common import TimeoutException
from sentry.dynamic_sampling.tasks.task_context import TaskContext
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task_with_context


def test_injection_dynamic_sampling_task_with_context():
    duration = 420

    @dynamic_sampling_task_with_context(max_task_execution=duration)
    def inner(context: TaskContext):
        assert context.name == "sentry.tasks.dynamic_sampling.inner"
        assert context.num_seconds == duration

    inner()


def test_log_dynamic_sampling_task_with_context():
    @dynamic_sampling_task_with_context(max_task_execution=100)
    def inner(context: TaskContext):
        pass

    inner()


def test_timeout_dynamic_sampling_task_with_context():
    @dynamic_sampling_task_with_context(max_task_execution=100)
    def inner(context: TaskContext):
        raise TimeoutException(context)

    with pytest.raises(TimeoutException):
        inner()
