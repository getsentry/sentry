import queue
import time
from multiprocessing import Event
from unittest import mock

import grpc
import pytest
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    ON_ATTEMPTS_EXCEEDED_DISCARD,
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_RETRY,
    RetryState,
    TaskActivation,
)
from sentry_sdk.crons import MonitorStatus
from usageaccountant import UsageUnit

from sentry.taskworker.client.inflight_task_activation import InflightTaskActivation
from sentry.taskworker.client.processing_result import ProcessingResult
from sentry.taskworker.retry import NoRetriesRemainingError
from sentry.taskworker.state import current_task
from sentry.taskworker.worker import TaskWorker
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded, child_process
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.utils.redis import redis_clusters

SIMPLE_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="111",
        taskname="examples.simple_task",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    ),
)

RETRY_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="222",
        taskname="examples.retry_task",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    ),
)

FAIL_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="333",
        taskname="examples.fail_task",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    ),
)

UNDEFINED_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="444",
        taskname="total.rubbish",
        namespace="lolnope",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    ),
)

AT_MOST_ONCE_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="555",
        taskname="examples.at_most_once",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
    ),
)

RETRY_STATE_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="654",
        taskname="examples.retry_state",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
        retry_state=RetryState(
            # no more attempts left
            attempts=1,
            max_attempts=2,
            on_attempts_exceeded=ON_ATTEMPTS_EXCEEDED_DISCARD,
        ),
    ),
)

SCHEDULED_TASK = InflightTaskActivation(
    host="localhost:50051",
    receive_timestamp=0,
    activation=TaskActivation(
        id="111",
        taskname="examples.simple_task",
        namespace="examples",
        parameters='{"args": [], "kwargs": {}}',
        processing_deadline_duration=2,
        headers={
            "sentry-monitor-slug": "simple-task",
            "sentry-monitor-check-in-id": "abc123",
        },
    ),
)


@pytest.mark.django_db
class TestTaskWorker(TestCase):
    def test_tasks_exist(self) -> None:
        import sentry.taskworker.tasks.examples as example_tasks

        assert example_tasks.simple_task
        assert example_tasks.retry_task
        assert example_tasks.at_most_once_task

    def test_fetch_task(self) -> None:
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=100, process_type="fork"
        )
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = SIMPLE_TASK

            task = taskworker.fetch_task()
            mock_get.assert_called_once()

        assert task
        assert task.activation.id == SIMPLE_TASK.activation.id

    def test_fetch_no_task(self) -> None:
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=100, process_type="fork"
        )
        with mock.patch.object(taskworker.client, "get_task") as mock_get:
            mock_get.return_value = None
            task = taskworker.fetch_task()

            mock_get.assert_called_once()
        assert task is None

    def test_run_once_no_next_task(self) -> None:
        max_runtime = 5
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=1, process_type="fork"
        )
        with mock.patch.object(taskworker, "client") as mock_client:
            mock_client.get_task.return_value = SIMPLE_TASK
            # No next_task returned
            mock_client.update_task.return_value = None

            taskworker.start_result_thread()
            taskworker.start_spawn_children_thread()
            start = time.time()
            while True:
                taskworker.run_once()
                if mock_client.update_task.called:
                    break
                if time.time() - start > max_runtime:
                    taskworker.shutdown()
                    raise AssertionError("Timeout waiting for update_task to be called")

            taskworker.shutdown()
            assert mock_client.get_task.called
            assert mock_client.update_task.call_count == 1
            assert mock_client.update_task.call_args.args[0].host == "localhost:50051"
            assert mock_client.update_task.call_args.args[0].task_id == SIMPLE_TASK.activation.id
            assert (
                mock_client.update_task.call_args.args[0].status == TASK_ACTIVATION_STATUS_COMPLETE
            )
            assert mock_client.update_task.call_args.args[1] is None

    def test_run_once_with_next_task(self) -> None:
        # Cover the scenario where update_task returns the next task which should
        # be processed.
        max_runtime = 5
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=1, process_type="fork"
        )
        with mock.patch.object(taskworker, "client") as mock_client:

            def update_task_response(*args, **kwargs):
                if mock_client.update_task.call_count >= 1:
                    return None
                return SIMPLE_TASK

            mock_client.update_task.side_effect = update_task_response
            mock_client.get_task.return_value = SIMPLE_TASK
            taskworker.start_result_thread()
            taskworker.start_spawn_children_thread()

            # Run until two tasks have been processed
            start = time.time()
            while True:
                taskworker.run_once()
                if mock_client.update_task.call_count >= 2:
                    break
                if time.time() - start > max_runtime:
                    taskworker.shutdown()
                    raise AssertionError("Timeout waiting for get_task to be called")

            taskworker.shutdown()
            assert mock_client.get_task.called
            assert mock_client.update_task.call_count == 2
            assert mock_client.update_task.call_args.args[0].host == "localhost:50051"
            assert mock_client.update_task.call_args.args[0].task_id == SIMPLE_TASK.activation.id
            assert (
                mock_client.update_task.call_args.args[0].status == TASK_ACTIVATION_STATUS_COMPLETE
            )
            assert mock_client.update_task.call_args.args[1] is None

    def test_run_once_with_update_failure(self) -> None:
        # Cover the scenario where update_task fails a few times in a row
        # We should retain the result until RPC succeeds.
        max_runtime = 5
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=1, process_type="fork"
        )
        with mock.patch.object(taskworker, "client") as mock_client:

            def update_task_response(*args, **kwargs):
                if mock_client.update_task.call_count <= 2:
                    # Use setattr() because internally grpc uses _InactiveRpcError
                    # but it isn't exported.
                    err = grpc.RpcError("update task failed")
                    setattr(err, "code", lambda: grpc.StatusCode.UNAVAILABLE)
                    raise err
                return None

            def get_task_response(*args, **kwargs):
                # Only one task that fails to update
                if mock_client.get_task.call_count == 1:
                    return SIMPLE_TASK
                return None

            mock_client.update_task.side_effect = update_task_response
            mock_client.get_task.side_effect = get_task_response
            taskworker.start_result_thread()
            taskworker.start_spawn_children_thread()

            # Run until the update has 'completed'
            start = time.time()
            while True:
                taskworker.run_once()
                if mock_client.update_task.call_count >= 3:
                    break
                if time.time() - start > max_runtime:
                    taskworker.shutdown()
                    raise AssertionError("Timeout waiting for get_task to be called")

            taskworker.shutdown()
            assert mock_client.get_task.called
            assert mock_client.update_task.call_count == 3

    def test_run_once_current_task_state(self) -> None:
        # Run a task that uses retry_task() helper
        # to raise and catch a NoRetriesRemainingError
        max_runtime = 5
        taskworker = TaskWorker(
            rpc_host="127.0.0.1:50051", num_brokers=1, max_child_task_count=1, process_type="fork"
        )
        with mock.patch.object(taskworker, "client") as mock_client:

            def update_task_response(*args, **kwargs):
                return None

            mock_client.update_task.side_effect = update_task_response
            mock_client.get_task.return_value = RETRY_STATE_TASK
            taskworker.start_result_thread()
            taskworker.start_spawn_children_thread()

            # Run until two tasks have been processed
            start = time.time()
            while True:
                taskworker.run_once()
                if mock_client.update_task.call_count >= 1:
                    break
                if time.time() - start > max_runtime:
                    taskworker.shutdown()
                    raise AssertionError("Timeout waiting for get_task to be called")

            taskworker.shutdown()
            assert mock_client.get_task.called
            assert mock_client.update_task.call_count == 1
            # status is complete, as retry_state task handles the NoRetriesRemainingError
            assert mock_client.update_task.call_args.args[0].host == "localhost:50051"
            assert (
                mock_client.update_task.call_args.args[0].task_id == RETRY_STATE_TASK.activation.id
            )
            assert (
                mock_client.update_task.call_args.args[0].status == TASK_ACTIVATION_STATUS_COMPLETE
            )
            assert mock_client.update_task.call_args.args[1] is None

            redis = redis_clusters.get("default")
            assert current_task() is None, "should clear current task on completion"
            assert redis.get("no-retries-remaining"), "key should exist if except block was hit"
            redis.delete("no-retries-remaining")


@pytest.mark.django_db
@mock.patch("sentry.taskworker.workerchild.capture_checkin")
def test_child_process_complete(mock_capture_checkin) -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(SIMPLE_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == SIMPLE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE
    assert mock_capture_checkin.call_count == 0


@pytest.mark.django_db
def test_child_process_remove_start_time_kwargs() -> None:
    activation = InflightTaskActivation(
        host="localhost:50051",
        receive_timestamp=0,
        activation=TaskActivation(
            id="6789",
            taskname="examples.will_retry",
            namespace="examples",
            parameters='{"args": ["stuff"], "kwargs": {"__start_time": 123}}',
            processing_deadline_duration=100000,
        ),
    )
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(activation)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == activation.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE


@pytest.mark.django_db
@mock.patch("sentry.usage_accountant.record")
def test_child_process_complete_record_usage(mock_record: mock.Mock) -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(SIMPLE_TASK)

    with override_options({"shared_resources_accounting_enabled": ["taskworker"]}):
        child_process(
            todo,
            processed,
            shutdown,
            max_task_count=1,
            processing_pool_name="test",
            process_type="fork",
        )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == SIMPLE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE

    assert mock_record.call_count == 1
    mock_record.assert_called_with(
        resource_id="taskworker",
        app_feature="examples",
        amount=mock.ANY,
        usage_type=UsageUnit.MILLISECONDS,
    )


@pytest.mark.django_db
def test_child_process_retry_task() -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(RETRY_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == RETRY_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_RETRY


@mock.patch("sentry.taskworker.workerchild.sentry_sdk.capture_exception")
@pytest.mark.django_db
def test_child_process_retry_task_max_attempts(mock_capture: mock.Mock) -> None:
    # Create an activation that is on its final attempt and
    # will raise an error again.
    activation = InflightTaskActivation(
        host="localhost:50051",
        receive_timestamp=0,
        activation=TaskActivation(
            id="6789",
            taskname="examples.will_retry",
            namespace="examples",
            parameters='{"args": ["raise"], "kwargs": {}}',
            processing_deadline_duration=100000,
            retry_state=RetryState(
                attempts=2,
                max_attempts=3,
            ),
        ),
    )
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(activation)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == activation.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE

    assert mock_capture.call_count == 1
    capture_call = mock_capture.call_args[0]
    # Error type and chained error should be captured.
    assert isinstance(capture_call[0], NoRetriesRemainingError)
    assert isinstance(capture_call[0].__cause__, RuntimeError)


@pytest.mark.django_db
def test_child_process_failure_task() -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(FAIL_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == FAIL_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE


@pytest.mark.django_db
def test_child_process_shutdown() -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()
    shutdown.set()

    todo.put(SIMPLE_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    # When shutdown has been set, the child should not process more tasks.
    assert todo.qsize() == 1
    assert processed.qsize() == 0


@pytest.mark.django_db
def test_child_process_unknown_task() -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(UNDEFINED_TASK)
    todo.put(SIMPLE_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    result = processed.get()
    assert result.task_id == UNDEFINED_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE

    result = processed.get()
    assert result.task_id == SIMPLE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE


@pytest.mark.django_db
def test_child_process_at_most_once() -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(AT_MOST_ONCE_TASK)
    todo.put(AT_MOST_ONCE_TASK)
    todo.put(SIMPLE_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=2,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get(block=False)
    assert result.task_id == AT_MOST_ONCE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE

    result = processed.get(block=False)
    assert result.task_id == SIMPLE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE


@pytest.mark.django_db
@mock.patch("sentry.taskworker.workerchild.capture_checkin")
def test_child_process_record_checkin(mock_capture_checkin: mock.Mock) -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    todo.put(SCHEDULED_TASK)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get()
    assert result.task_id == SIMPLE_TASK.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_COMPLETE

    assert mock_capture_checkin.call_count == 1
    mock_capture_checkin.assert_called_with(
        monitor_slug="simple-task",
        check_in_id="abc123",
        duration=mock.ANY,
        status=MonitorStatus.OK,
    )


@pytest.mark.django_db
@mock.patch("sentry.taskworker.workerchild.sentry_sdk.capture_exception")
def test_child_process_terminate_task(mock_capture: mock.Mock) -> None:
    todo: queue.Queue[InflightTaskActivation] = queue.Queue()
    processed: queue.Queue[ProcessingResult] = queue.Queue()
    shutdown = Event()

    sleepy = InflightTaskActivation(
        host="localhost:50051",
        receive_timestamp=0,
        activation=TaskActivation(
            id="111",
            taskname="examples.timed",
            namespace="examples",
            parameters='{"args": [3], "kwargs": {}}',
            processing_deadline_duration=1,
        ),
    )

    todo.put(sleepy)
    child_process(
        todo,
        processed,
        shutdown,
        max_task_count=1,
        processing_pool_name="test",
        process_type="fork",
    )

    assert todo.empty()
    result = processed.get(block=False)
    assert result.task_id == sleepy.activation.id
    assert result.status == TASK_ACTIVATION_STATUS_FAILURE
    assert mock_capture.call_count == 1
    assert type(mock_capture.call_args.args[0]) is ProcessingDeadlineExceeded
