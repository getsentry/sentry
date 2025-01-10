import queue
import time
from multiprocessing import Event
from unittest import mock

from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    FetchNextTask,
    TaskActivation,
)

import sentry.taskworker.tasks.examples as example_tasks
from sentry.taskworker.worker import ProcessingResult, TaskWorker, child_worker
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

    def test_run_once(self) -> None:
        max_runtime = 5
        taskworker = TaskWorker(rpc_host="127.0.0.1:50051", max_task_count=1)
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            mock_client.update_task.return_value = None

            # Run once to add the task and then poll until the task is complete.
            taskworker.run_once()
            start = time.time()
            while True:
                taskworker.run_once()
                if mock_client.update_task.called:
                    break
                if time.time() - start > max_runtime:
                    raise AssertionError("Timeout waiting for get_task to be called")

            assert mock_client.get_task.called
            mock_client.update_task.assert_called_with(
                task_id=SIMPLE_TASK.id,
                status=TASK_ACTIVATION_STATUS_COMPLETE,
                fetch_next_task=FetchNextTask(namespace=None),
            )


def test_child_worker_complete() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(SIMPLE_TASK)
    child_worker(todo, processed, shutdown, max_task_count=1)

    assert todo.empty()
    result = processed.get()
    assert result.task_id == SIMPLE_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE


def test_child_worker_retry_task() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(RETRY_TASK)
    child_worker(todo, processed, shutdown, max_task_count=1)

    assert todo.empty()
    result = processed.get()
    assert result.task_id == RETRY_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_RETRY


def test_child_worker_failure_task() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(FAIL_TASK)
    child_worker(todo, processed, shutdown, max_task_count=1)

    assert todo.empty()
    result = processed.get()
    assert result.task_id == FAIL_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE


def test_child_worker_shutdown() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()
    shutdown.set()

    todo.put(SIMPLE_TASK)
    child_worker(todo, processed, shutdown, max_task_count=1)

    # When shutdown has been set, the child should not process more tasks.
    assert todo.qsize() == 1
    assert processed.qsize() == 0


def test_child_worker_unknown_task() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(UNDEFINED_TASK)
    todo.put(SIMPLE_TASK)
    child_worker(todo, processed, shutdown, max_task_count=1)

    result = processed.get()
    assert result.task_id == UNDEFINED_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE

    result = processed.get()
    assert result.task_id == SIMPLE_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE


def test_child_worker_at_most_once() -> None:
    todo: queue.Queue[TaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(AT_MOST_ONCE_TASK)
    todo.put(AT_MOST_ONCE_TASK)
    todo.put(SIMPLE_TASK)
    child_worker(todo, processed, shutdown, max_task_count=2)

    assert todo.empty()
    result = processed.get(block=False)
    assert result.task_id == AT_MOST_ONCE_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE

    result = processed.get(block=False)
    assert result.task_id == SIMPLE_TASK.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE
