import datetime
import logging

import pytest

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.registry import TaskNamespace
from sentry.taskworker.retry import LastAction, Retry, RetryError
from sentry.taskworker.task import Task
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.utils import json


def do_things() -> None:
    logging.info("Ran do_things")


@pytest.fixture
def task_namespace() -> TaskNamespace:
    return TaskNamespace(name="tests", topic=Topic.TASK_WORKER, retry=None)


def test_define_task_defaults(task_namespace: TaskNamespace) -> None:
    task = Task(name="test.do_things", func=do_things, namespace=task_namespace)
    assert task.retry is None
    assert task.name == "test.do_things"


def test_define_task_retry(task_namespace: TaskNamespace) -> None:
    retry = Retry(times=3, times_exceeded=LastAction.Deadletter)
    task = Task(name="test.do_things", func=do_things, namespace=task_namespace, retry=retry)
    assert task.retry == retry


def test_delay_taskrunner_immediate_mode(task_namespace: TaskNamespace) -> None:
    calls = []

    def test_func(*args, **kwargs) -> None:
        calls.append({"args": args, "kwargs": kwargs})

    task = Task(
        name="test.test_func",
        func=test_func,
        namespace=task_namespace,
    )
    # Within a TaskRunner context tasks should run immediately.
    # This emulates the behavior we have with celery.
    with TaskRunner():
        task.delay("arg", org_id=1)
        task.apply_async("arg2", org_id=2)

    assert len(calls) == 2
    assert calls[0] == {"args": ("arg",), "kwargs": {"org_id": 1}}
    assert calls[1] == {"args": ("arg2",), "kwargs": {"org_id": 2}}


def test_should_retry(task_namespace: TaskNamespace) -> None:
    retry = Retry(times=3, times_exceeded=LastAction.Deadletter)
    state = retry.initial_state()

    task = Task(
        name="test.do_things",
        func=do_things,
        namespace=task_namespace,
        retry=retry,
    )
    err = RetryError("try again plz")
    assert task.should_retry(state, err)

    state.attempts = 3
    assert not task.should_retry(state, err)

    no_retry = Task(
        name="test.no_retry",
        func=do_things,
        namespace=task_namespace,
        retry=None,
    )
    assert not no_retry.should_retry(state, err)


def test_create_activation(task_namespace: TaskNamespace) -> None:
    no_retry_task = Task(
        name="test.no_retry",
        func=do_things,
        namespace=task_namespace,
        retry=None,
    )

    retry = Retry(times=3, times_exceeded=LastAction.Deadletter)
    retry_task = Task(
        name="test.with_retry",
        func=do_things,
        namespace=task_namespace,
        retry=retry,
    )

    timedelta_expiry_task = Task(
        name="test.with_timedelta_expires",
        func=do_things,
        namespace=task_namespace,
        expires=datetime.timedelta(minutes=5),
        processing_deadline_duration=datetime.timedelta(seconds=30),
    )
    int_expiry_task = Task(
        name="test.with_int_expires",
        func=do_things,
        namespace=task_namespace,
        expires=5 * 60,
        processing_deadline_duration=30,
    )

    # No retries will be made as there is no retry policy on the task or namespace.
    activation = no_retry_task.create_activation()
    assert activation.taskname == "test.no_retry"
    assert activation.namespace == task_namespace.name
    assert activation.retry_state
    assert activation.retry_state.attempts == 0
    assert activation.retry_state.discard_after_attempt == 1

    activation = retry_task.create_activation()
    assert activation.taskname == "test.with_retry"
    assert activation.namespace == task_namespace.name
    assert activation.retry_state
    assert activation.retry_state.attempts == 0
    assert activation.retry_state.discard_after_attempt == 0
    assert activation.retry_state.deadletter_after_attempt == 3

    activation = timedelta_expiry_task.create_activation()
    assert activation.taskname == "test.with_timedelta_expires"
    assert activation.expires == 300
    assert activation.processing_deadline_duration == 30

    activation = int_expiry_task.create_activation()
    assert activation.taskname == "test.with_int_expires"
    assert activation.expires == 300
    assert activation.processing_deadline_duration == 30


def test_create_activation_parameters(task_namespace: TaskNamespace) -> None:
    @task_namespace.register(name="test.parameters")
    def with_parameters(one: str, two: int, org_id: int) -> None:
        pass

    activation = with_parameters.create_activation("one", 22, org_id=99)
    params = json.loads(activation.parameters)
    assert params["args"]
    assert params["args"] == ["one", 22]
    assert params["kwargs"] == {"org_id": 99}
