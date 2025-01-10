from concurrent.futures import Future
from unittest.mock import patch

import pytest
from django.test.utils import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.registry import TaskNamespace, TaskRegistry
from sentry.taskworker.retry import LastAction, Retry
from sentry.taskworker.task import Task


def test_namespace_register_task() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=None,
    )

    @namespace.register(name="tests.simple_task")
    def simple_task():
        raise NotImplementedError

    assert namespace.default_retry is None
    assert namespace.contains("tests.simple_task")
    assert not namespace.contains("nope")

    task = namespace.get("tests.simple_task")
    assert task
    assert task.name == "tests.simple_task"


def test_namespace_register_inherits_default_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=Retry(times=5, on=(RuntimeError,)),
    )

    @namespace.register(name="test.no_retry_param")
    def no_retry_param() -> None:
        raise NotImplementedError

    retry = Retry(times=2, times_exceeded=LastAction.Deadletter)

    @namespace.register(name="test.with_retry_param", retry=retry)
    def with_retry_param() -> None:
        raise NotImplementedError

    with_retry = namespace.get("test.with_retry_param")
    assert with_retry.retry == retry

    @namespace.register(name="test.retry_none", retry=None)
    def retry_none_param() -> None:
        raise NotImplementedError

    with_retry = namespace.get("test.retry_none")
    assert with_retry.retry == namespace.default_retry


def test_register_inherits_default_expires_processing_deadline() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=None,
        expires=10 * 60,
        processing_deadline_duration=5,
    )

    @namespace.register(name="test.no_expires")
    def no_expires() -> None:
        raise NotImplementedError

    @namespace.register(name="test.with_expires", expires=30 * 60, processing_deadline_duration=10)
    def with_expires() -> None:
        raise NotImplementedError

    no_expires_task = namespace.get("test.no_expires")
    activation = no_expires_task.create_activation()
    assert activation.expires == 10 * 60
    assert activation.processing_deadline_duration == 5

    with_expires_task = namespace.get("test.with_expires")
    activation = with_expires_task.create_activation()
    assert activation.expires == 30 * 60
    assert activation.processing_deadline_duration == 10


def test_namespace_get_unknown() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=None,
    )

    with pytest.raises(KeyError) as err:
        namespace.get("nope")
    assert "No task registered" in str(err)


def test_namespace_send_task_no_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=None,
    )

    @namespace.register(name="test.simpletask")
    def simple_task() -> None:
        raise NotImplementedError

    activation = simple_task.create_activation()
    assert activation.retry_state.attempts == 0
    assert activation.retry_state.deadletter_after_attempt == 0
    assert activation.retry_state.discard_after_attempt == 1

    with patch.object(namespace, "producer") as mock_producer:
        namespace.send_task(activation)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        assert mock_call[0][0].name == "task-worker"

        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()


def test_namespace_send_task_with_retry() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=None,
    )

    @namespace.register(
        name="test.simpletask", retry=Retry(times=3, times_exceeded=LastAction.Deadletter)
    )
    def simple_task() -> None:
        raise NotImplementedError

    activation = simple_task.create_activation()
    assert activation.retry_state.attempts == 0
    assert activation.retry_state.deadletter_after_attempt == 3
    assert activation.retry_state.discard_after_attempt == 0

    with patch.object(namespace, "producer") as mock_producer:
        namespace.send_task(activation)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()


def test_namespace_with_retry_send_task() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=Retry(times=3),
    )

    @namespace.register(name="test.simpletask")
    def simple_task() -> None:
        raise NotImplementedError

    activation = simple_task.create_activation()
    assert activation.retry_state.attempts == 0
    assert activation.retry_state.deadletter_after_attempt == 3
    assert activation.retry_state.discard_after_attempt == 0

    with patch.object(namespace, "producer") as mock_producer:
        namespace.send_task(activation)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        assert mock_call[0][0].name == "task-worker"

        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()


def test_namespace_with_wait_for_delivery_send_task() -> None:
    namespace = TaskNamespace(
        name="tests",
        topic=Topic.TASK_WORKER,
        retry=Retry(times=3),
    )

    @namespace.register(name="test.simpletask", wait_for_delivery=True)
    def simple_task() -> None:
        raise NotImplementedError

    activation = simple_task.create_activation()

    with patch.object(namespace, "producer") as mock_producer:
        ret_value = Future()
        ret_value.set_result(None)
        mock_producer.produce.return_value = ret_value
        namespace.send_task(activation, wait_for_delivery=True)
        assert mock_producer.produce.call_count == 1

        mock_call = mock_producer.produce.call_args
        assert mock_call[0][0].name == "task-worker"

        proto_message = mock_call[0][1].value
        assert proto_message == activation.SerializeToString()


def test_registry_get() -> None:
    registry = TaskRegistry()
    ns = registry.create_namespace(name="tests")

    assert isinstance(ns, TaskNamespace)
    assert ns.name == "tests"
    assert ns.topic
    assert ns == registry.get("tests")

    with pytest.raises(KeyError):
        registry.get("derp")

    assert registry.contains("derp") is False
    assert registry.contains("tests")


def test_registry_get_task() -> None:
    registry = TaskRegistry()
    ns = registry.create_namespace(name="tests")

    @ns.register(name="test.simpletask")
    def simple_task() -> None:
        raise NotImplementedError

    task = registry.get_task(ns.name, "test.simpletask")
    assert isinstance(task, Task)

    with pytest.raises(KeyError):
        registry.get_task("nope", "test.simpletask")

    with pytest.raises(KeyError):
        registry.get_task(ns.name, "nope")


def test_registry_create_namespace_simple() -> None:
    registry = TaskRegistry()
    ns = registry.create_namespace(name="tests")
    assert ns.default_retry is None
    assert ns.default_expires is None
    assert ns.default_processing_deadline_duration == 5
    assert ns.name == "tests"
    assert ns.topic == Topic.TASK_WORKER

    retry = Retry(times=3)
    ns = registry.create_namespace(
        "test-two", retry=retry, expires=60 * 10, processing_deadline_duration=60
    )
    assert ns.default_retry == retry
    assert ns.default_processing_deadline_duration == 60
    assert ns.default_expires == 60 * 10
    assert ns.name == "test-two"
    assert ns.topic == Topic.TASK_WORKER


def test_registry_create_namespace_route_setting() -> None:
    routes = {
        "profiling": "profiles",
        "lol": "nope",
    }
    with override_settings(TASKWORKER_ROUTES=routes):
        registry = TaskRegistry()

        # namespaces without routes resolve to the default topic.
        tests = registry.create_namespace(name="tests")
        assert tests.topic == Topic.TASK_WORKER

        profiling = registry.create_namespace(name="profiling")
        assert profiling.topic == Topic.PROFILES

        with pytest.raises(ValueError):
            registry.create_namespace(name="lol")
