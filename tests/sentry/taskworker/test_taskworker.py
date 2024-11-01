import datetime
from unittest import mock

from dateutil.relativedelta import relativedelta
from google.protobuf.timestamp_pb2 import Timestamp
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


class MockResponse:
    """
    TODO: Temporary class to mock reponses from GRPC server.
    We can remove this when we actually implement GRPC and the reponse protobuf.
    """

    def __init__(self, task: TaskActivation, processing_deadline: Timestamp):
        self.task = task
        self.processing_deadline = processing_deadline

    def HasField(self, field: str) -> bool:
        return hasattr(self, field)


MOCK_SIMPLE_RESPONSE = MockResponse(
    task=TaskActivation(
        id="111", taskname="test.simple_task", parameters='{"args": [], "kwargs": {}}'
    ),
    processing_deadline=Timestamp(
        seconds=int((datetime.datetime.now() + relativedelta(months=+1)).timestamp())
    ),
)

MOCK_RETRY_RESPONSE = MockResponse(
    task=TaskActivation(
        id="222", taskname="test.retry_task", parameters='{"args": [], "kwargs": {}}'
    ),
    processing_deadline=Timestamp(
        seconds=int((datetime.datetime.now() + relativedelta(months=+1)).timestamp())
    ),
)

MOCK_TIMEOUT_RESPONSE = MockResponse(
    task=TaskActivation(
        id="333", taskname="test.retry_task", parameters='{"args": [], "kwargs": {}}'
    ),
    processing_deadline=Timestamp(
        seconds=int((datetime.datetime.now() + relativedelta(seconds=-1)).timestamp())
    ),
)


class TestTaskWorker(TestCase):
    @mock.patch(
        "sentry.taskworker.service.client.task_client.get_task",
        return_value=MOCK_SIMPLE_RESPONSE,
    )
    def test_taskworker_fetch_task(self, task_client: mock.MagicMock) -> None:
        taskworker = TaskWorker(namespace="tests")
        task, processing_deadline = taskworker.fetch_task()

        task_client.assert_called_once()
        assert task.id == MOCK_SIMPLE_RESPONSE.task.id
        assert (
            int(processing_deadline.timestamp()) == MOCK_SIMPLE_RESPONSE.processing_deadline.seconds
        )

        taskworker._pool.terminate()

    @mock.patch(
        "sentry.taskworker.service.client.task_client.get_task",
        return_value=None,
    )
    def test_taskworker_fetch_no_task(self, task_client: mock.MagicMock) -> None:
        taskworker = TaskWorker(namespace="tests")
        task, processing_deadline = taskworker.fetch_task()

        task_client.assert_called_once()
        assert task is None
        assert processing_deadline is None

        taskworker._pool.terminate()

    @mock.patch(
        "sentry.taskworker.service.client.task_client.complete_task",
        return_value=MOCK_SIMPLE_RESPONSE,
    )
    def test_taskworker_process_task_complete(self, task_client_complete: mock.MagicMock) -> None:
        taskworker = TaskWorker(namespace="tests")
        next_task, next_processing_deadline = taskworker.process_task(
            MOCK_SIMPLE_RESPONSE.task, MOCK_SIMPLE_RESPONSE.processing_deadline.ToDatetime()
        )
        task_client_complete.assert_called_with(task_id=MOCK_SIMPLE_RESPONSE.task.id)
        assert next_task.id == MOCK_SIMPLE_RESPONSE.task.id
        assert (
            int(next_processing_deadline.timestamp())
            == MOCK_SIMPLE_RESPONSE.processing_deadline.seconds
        )

        taskworker._pool.terminate()

    @mock.patch(
        "sentry.taskworker.service.client.task_client.set_task_status",
        return_value=MOCK_SIMPLE_RESPONSE,
    )
    def test_taskworker_process_task_retry(self, task_client_set: mock.MagicMock) -> None:
        taskworker = TaskWorker(namespace="tests")
        next_task, next_processing_deadline = taskworker.process_task(
            MOCK_RETRY_RESPONSE.task, MOCK_RETRY_RESPONSE.processing_deadline.ToDatetime()
        )
        task_client_set.assert_called_with(
            task_id=MOCK_RETRY_RESPONSE.task.id, task_status=TASK_ACTIVATION_STATUS_RETRY
        )
        assert next_task.id == MOCK_SIMPLE_RESPONSE.task.id
        assert (
            int(next_processing_deadline.timestamp())
            == MOCK_SIMPLE_RESPONSE.processing_deadline.seconds
        )

        taskworker._pool.terminate()

    @mock.patch(
        "sentry.taskworker.service.client.task_client.set_task_status",
        return_value=MOCK_SIMPLE_RESPONSE,
    )
    def test_taskworker_process_task_timeout_failure(self, task_client_set: mock.MagicMock) -> None:
        taskworker = TaskWorker(namespace="tests")
        next_task, next_processing_deadline = taskworker.process_task(
            MOCK_TIMEOUT_RESPONSE.task, MOCK_TIMEOUT_RESPONSE.processing_deadline.ToDatetime()
        )
        task_client_set.assert_called_with(
            task_id=MOCK_TIMEOUT_RESPONSE.task.id, task_status=TASK_ACTIVATION_STATUS_FAILURE
        )
        assert next_task.id == MOCK_SIMPLE_RESPONSE.task.id
        assert (
            int(next_processing_deadline.timestamp())
            == MOCK_SIMPLE_RESPONSE.processing_deadline.seconds
        )

        taskworker._pool.terminate()
