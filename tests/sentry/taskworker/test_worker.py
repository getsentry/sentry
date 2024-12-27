from unittest import mock

from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    FetchNextTask,
    TaskActivation,
)

import sentry.taskworker.tasks.examples as example_tasks
from sentry.taskworker.worker import TaskWorker
from sentry.testutils.cases import TestCase

SIMPLE_TASK = TaskActivation(
    id="111",
    taskname="examples.simple_task",
    namespace="examples",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=2,
)

RETRY_TASK = TaskActivation(
    id="222",
    taskname="examples.retry_task",
    namespace="examples",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=2,
)

FAIL_TASK = TaskActivation(
    id="333",
    taskname="examples.fail_task",
    namespace="examples",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=2,
)

UNDEFINED_TASK = TaskActivation(
    id="444",
    taskname="total.rubbish",
    namespace="lolnope",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=2,
)

AT_MOST_ONCE_TASK = TaskActivation(
    id="555",
    taskname="examples.at_most_once",
    namespace="examples",
    parameters='{"args": [], "kwargs": {}}',
    processing_deadline_duration=2,
)


class TestTaskWorker(TestCase):
    def test_tasks_exist(self) -> None:
        assert example_tasks.simple_task
        assert example_tasks.retry_task
        assert example_tasks.at_most_once_task

    def test_fetch_task(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = SIMPLE_TASK

            task = taskworker.fetch_task()
            mock_get.assert_called_once()

        assert task
        assert task.id == SIMPLE_TASK.id

    def test_fetch_no_task(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = None
            task = taskworker.fetch_task()

            mock_get.assert_called_once()
        assert task is None

    def test_process_task_complete(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "update_task") as mock_update:
            mock_update.return_value = RETRY_TASK

            result = taskworker.process_task(SIMPLE_TASK)

            mock_update.assert_called_with(
                task_id=SIMPLE_TASK.id,
                status=TASK_ACTIVATION_STATUS_COMPLETE,
                fetch_next_task=FetchNextTask(namespace=None),
            )

            assert result
            assert result.id == RETRY_TASK.id

    def test_process_task_retry(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "update_task") as mock_update:
            mock_update.return_value = SIMPLE_TASK
            result = taskworker.process_task(RETRY_TASK)

            mock_update.assert_called_with(
                task_id=RETRY_TASK.id,
                status=TASK_ACTIVATION_STATUS_RETRY,
                fetch_next_task=FetchNextTask(namespace=None),
            )

            assert result
            assert result.id == SIMPLE_TASK.id

    def test_process_task_failure(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "update_task") as mock_update:
            mock_update.return_value = SIMPLE_TASK
            result = taskworker.process_task(FAIL_TASK)

            mock_update.assert_called_with(
                task_id=FAIL_TASK.id,
                status=TASK_ACTIVATION_STATUS_FAILURE,
                fetch_next_task=FetchNextTask(namespace=None),
            )
            assert result
            assert result.id == SIMPLE_TASK.id

    def test_process_task_at_most_once(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=100)
        with mock.patch.object(taskworker.client, "update_task") as mock_update:
            mock_update.return_value = SIMPLE_TASK
            result = taskworker.process_task(AT_MOST_ONCE_TASK)

            mock_update.assert_called_with(
                task_id=AT_MOST_ONCE_TASK.id,
                status=TASK_ACTIVATION_STATUS_COMPLETE,
                fetch_next_task=FetchNextTask(namespace=None),
            )
        assert taskworker.process_task(AT_MOST_ONCE_TASK) is None
        assert result
        assert result.id == SIMPLE_TASK.id

        result = taskworker.process_task(AT_MOST_ONCE_TASK)
        assert result is None

    def test_start_max_task_count(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=1)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            mock_client.update_task.return_value = None

            result = taskworker.start()

            # start should exit after completing the one task
            assert result == 0
            assert mock_client.get_task.called
            mock_client.update_task.assert_called_with(
                task_id=SIMPLE_TASK.id,
                status=TASK_ACTIVATION_STATUS_COMPLETE,
                fetch_next_task=FetchNextTask(namespace=None),
            )

    def test_start_loop(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=2)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            mock_client.update_task.side_effect = [RETRY_TASK, None]

            # Because complete_task is returning another task, we should get
            # two executions. One successful and one retry
            result = taskworker.start()

            # start should exit after completing the both task
            assert result == 0
            assert mock_client.get_task.call_count == 1
            assert mock_client.update_task.call_count == 2

            mock_client.update_task.assert_any_call(
                task_id=SIMPLE_TASK.id,
                status=TASK_ACTIVATION_STATUS_COMPLETE,
                fetch_next_task=FetchNextTask(namespace=None),
            )
            mock_client.update_task.assert_any_call(
                task_id=RETRY_TASK.id,
                status=TASK_ACTIVATION_STATUS_RETRY,
                fetch_next_task=FetchNextTask(namespace=None),
            )

    def test_start_keyboard_interrupt(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=2)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.side_effect = KeyboardInterrupt()

            result = taskworker.start()
            assert result == 1, "Exit non-zero"

    def test_start_unknown_task(self) -> None:
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=2)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = UNDEFINED_TASK

            result = taskworker.start()
            assert result == 0, "Exit zero, all tasks complete"
            mock_client.update_task.assert_any_call(
                task_id=UNDEFINED_TASK.id,
                status=TASK_ACTIVATION_STATUS_FAILURE,
                fetch_next_task=FetchNextTask(namespace=None),
            )
