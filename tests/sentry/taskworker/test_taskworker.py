from unittest import mock

from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    TaskActivation,
)

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.registry import taskregistry
from sentry.taskworker.retry import Retry, RetryError
from sentry.taskworker.taskworker import TaskWorker
from sentry.testutils.cases import TestCase

test_namespace = taskregistry.create_namespace(
    name="tests",
    topic=Topic.TASK_WORKER.value,
    deadletter_topic=Topic.TASK_WORKER_DLQ.value,
    retry=Retry(times=2),
)


@test_namespace.register(name="test.simple_task")
def simple_task():
    pass


@test_namespace.register(name="test.retry_task")
def retry_task():
    raise RetryError


@test_namespace.register(name="test.fail_task")
def fail_task():
    raise ValueError("nope")


SIMPLE_TASK = TaskActivation(
    id="111",
    taskname="test.simple_task",
    namespace="tests",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=1,
)

RETRY_TASK = TaskActivation(
    id="222",
    taskname="test.retry_task",
    namespace="tests",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=1,
)

FAIL_TASK = TaskActivation(
    id="333",
    taskname="test.fail_task",
    namespace="tests",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=1,
)


class TestTaskWorker(TestCase):
    def test_taskworker_fetch_task(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = SIMPLE_TASK

            task = taskworker.fetch_task()
            mock_get.assert_called_once()

        assert task
        assert task.id == SIMPLE_TASK.id

    def test_taskworker_fetch_no_task(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = None
            task = taskworker.fetch_task()

            mock_get.assert_called_once()
        assert task is None

    def test_taskworker_process_task_complete(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "complete_task") as mock_complete:
            mock_complete.return_value = RETRY_TASK

            result = taskworker.process_task(SIMPLE_TASK)

            mock_complete.assert_called_with(task_id=SIMPLE_TASK.id)

            assert result
            assert result.id == RETRY_TASK.id

    def test_taskworker_process_task_retry(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "set_task_status") as mock_set_task_status:
            mock_set_task_status.return_value = SIMPLE_TASK
            result = taskworker.process_task(RETRY_TASK)

            mock_set_task_status.assert_called_with(
                task_id=RETRY_TASK.id, task_status=TASK_ACTIVATION_STATUS_RETRY
            )

            assert result
            assert result.id == SIMPLE_TASK.id

    def test_taskworker_process_task_failure(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "set_task_status") as mock_set_task_status:
            mock_set_task_status.return_value = SIMPLE_TASK
            result = taskworker.process_task(FAIL_TASK)

            mock_set_task_status.assert_called_with(
                task_id=FAIL_TASK.id, task_status=TASK_ACTIVATION_STATUS_FAILURE
            )
            assert result
            assert result.id == SIMPLE_TASK.id

    def test_taskworker_start_max_task_count(self):
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=1)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            mock_client.complete_task.return_value = None

            result = taskworker.start()

            # start should exit after completing the one task
            assert result == 0
            assert mock_client.get_task.called
            mock_client.complete_task.assert_called_with(task_id=SIMPLE_TASK.id)

    def test_taskworker_start_loop(self):
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=2)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            mock_client.complete_task.return_value = RETRY_TASK
            mock_client.set_task_status.return_value = None

            # Because complete_task is returning another task, we should get
            # two executions. One successful and one retry
            result = taskworker.start()

            # start should exit after completing the both task
            assert result == 0
            assert mock_client.get_task.call_count == 1
            assert mock_client.complete_task.call_count == 1
            assert mock_client.set_task_status.call_count == 1

            mock_client.complete_task.assert_called_with(task_id=SIMPLE_TASK.id)
            mock_client.set_task_status.assert_called_with(
                task_id=RETRY_TASK.id, task_status=TASK_ACTIVATION_STATUS_RETRY
            )
