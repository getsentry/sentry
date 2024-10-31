import logging
from unittest.mock import patch

import pytest

from sentry.taskworker.registry import TaskNamespace
from sentry.taskworker.retry import LastAction, Retry


def test_register_task() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic="tests",
        deadletter_topic="tests-dlq",
        retry=None,
    )

    @namespace.register(name="tests.simple_task")
    def simple_task():
        logging.info("simple_task")

    assert namespace.default_retry is None
    assert namespace.contains("tests.simple_task")
    assert not namespace.contains("nope")

    task = namespace.get("tests.simple_task")
    assert task
    assert task.name == "tests.simple_task"


def test_register_inherits_default_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic="tests",
        deadletter_topic="tests-dlq",
        retry=Retry(times=5, on=(RuntimeError,)),
    )

    @namespace.register(name="test.no_retry_param")
    def no_retry_param() -> None:
        pass

    retry = Retry(times=2, times_exceeded=LastAction.Deadletter)

    @namespace.register(name="test.with_retry_param", retry=retry)
    def with_retry_param() -> None:
        pass

    with_retry = namespace.get("test.with_retry_param")
    assert with_retry.retry == retry

    @namespace.register(name="test.retry_none", retry=None)
    def retry_none_param() -> None:
        pass

    with_retry = namespace.get("test.retry_none")
    assert with_retry.retry == namespace.default_retry


def test_get_unknown() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic="tests",
        deadletter_topic="tests-dlq",
        retry=None,
    )

    with pytest.raises(KeyError) as err:
        namespace.get("nope")
    assert "No task registered" in str(err)


def test_send_task_no_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic="tests",
        deadletter_topic="tests-dlq",
        retry=None,
    )

    @namespace.register(name="test.simpletask")
    def simple_task() -> None:
        pass

    activation = simple_task.create_activation()

    with patch.object(namespace, "producer") as mock_producer:
        namespace.send_task(activation)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        assert mock_call[0][0].name == "tests"

        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()


def test_send_task_with_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic="tests",
        deadletter_topic="tests-dlq",
        retry=None,
    )

    @namespace.register(
        name="test.simpletask", retry=Retry(times=3, times_exceeded=LastAction.Deadletter)
    )
    def simple_task() -> None:
        pass

    activation = simple_task.create_activation()

    with patch.object(namespace, "producer") as mock_producer:
        namespace.send_task(activation)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()
