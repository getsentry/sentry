import dataclasses
import random
import string
import time
from collections import defaultdict
from collections.abc import Callable
from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch

import grpc
import pytest
from google.protobuf.message import Message
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_RETRY,
    FetchNextTask,
    GetTaskRequest,
    GetTaskResponse,
    SetTaskStatusRequest,
    SetTaskStatusResponse,
    TaskActivation,
)

from sentry.taskworker.client.client import (
    HealthCheckSettings,
    HostTemporarilyUnavailable,
    TaskworkerClient,
    make_broker_hosts,
)
from sentry.taskworker.client.processing_result import ProcessingResult
from sentry.taskworker.constants import DEFAULT_WORKER_HEALTH_CHECK_SEC_PER_TOUCH
from sentry.testutils.pytest.fixtures import django_db_all


@dataclasses.dataclass
class MockServiceCall:
    response: Any
    metadata: tuple[tuple[str, str | bytes], ...] | None = None


class MockServiceMethod:
    """Stub for grpc service methods"""

    def __init__(
        self,
        path: str,
        responses: list[Any],
        request_serializer: Callable,
        response_deserializer: Callable,
    ):
        self.path = path
        self.request_serializer = request_serializer
        self.response_deserializer = response_deserializer
        self.responses = responses

    def __call__(self, *args, **kwargs):
        """Capture calls and use registered mocks"""
        # move the head to the tail
        res = self.responses[0]
        tail = self.responses[1:]
        self.responses = tail + [res]

        if isinstance(res.response, Exception):
            raise res.response
        elif callable(res.response):
            return res.response(*args, **kwargs)
        return res.response

    def with_call(self, *args, **kwargs):
        res = self.responses[0]
        if res.metadata:
            assert res.metadata == kwargs.get("metadata"), "Metadata mismatch"
        if isinstance(res.response, Exception):
            raise res.response
        return (res.response, None)


class MockChannel:
    def __init__(self):
        self._responses = defaultdict(list)

    def unary_unary(
        self,
        path: str,
        request_serializer: Callable,
        response_deserializer: Callable,
        *args,
        **kwargs,
    ):
        return MockServiceMethod(
            path, self._responses.get(path, []), request_serializer, response_deserializer
        )

    def add_response(
        self,
        path: str,
        resp: Callable | Message | Exception,
        metadata: tuple[tuple[str, str | bytes], ...] | None = None,
    ):
        self._responses[path].append(MockServiceCall(response=resp, metadata=metadata))


class MockGrpcError(grpc.RpcError):
    """Grpc error are elusive and this mock simulates the interface in mypy stubs"""

    def __init__(self, code, message):
        self._code = code
        self._message = message

    def code(self) -> grpc.StatusCode:
        return self._code

    def details(self) -> str:
        return self._message

    def result(self):
        raise self


def test_make_broker_hosts() -> None:
    hosts = make_broker_hosts(host_prefix="broker:50051", num_brokers=3)
    assert len(hosts) == 3
    assert hosts == ["broker-0:50051", "broker-1:50051", "broker-2:50051"]

    hosts = make_broker_hosts(
        host_prefix="",
        num_brokers=None,
        host_list="broker:50051, broker-a:50051 ,  , broker-b:50051",
    )
    assert len(hosts) == 3
    assert hosts == ["broker:50051", "broker-a:50051", "broker-b:50051"]


@django_db_all
def test_init_no_hosts() -> None:
    with pytest.raises(AssertionError) as err:
        TaskworkerClient(hosts=[], application="sentry")
    assert "You must provide at least one RPC host" in str(err)


@django_db_all
def test_health_check_is_debounced() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        health_check_path = Path(f"/tmp/{''.join(random.choices(string.ascii_letters, k=16))}")
        client = TaskworkerClient(
            ["localhost-0:50051"],
            application="sentry",
            health_check_settings=HealthCheckSettings(health_check_path, 1),
        )
        client._health_check_settings.file_path = Mock()  # type: ignore[union-attr]

        _ = client.get_task()
        _ = client.get_task()
        assert client._health_check_settings.file_path.touch.call_count == 1  # type: ignore[union-attr]

        with patch("sentry.taskworker.client.client.time") as mock_time:
            mock_time.time.return_value = time.time() + 1
            _ = client.get_task()
            assert client._health_check_settings.file_path.touch.call_count == 2  # type: ignore[union-attr]


@django_db_all
def test_get_task_ok() -> None:

    def get_task_response(request: GetTaskRequest) -> GetTaskResponse:
        assert request.application == "sentry"
        assert request.namespace == ""

        return GetTaskResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        )

    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        get_task_response,
    )

    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost-0:50051"], application="sentry")
        result = client.get_task()

        assert result
        assert result.host == "localhost-0:50051"
        assert result.activation.id
        assert result.activation.namespace == "testing"


@django_db_all
def test_get_task_writes_to_health_check_file() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )

    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        health_check_path = Path(f"/tmp/{''.join(random.choices(string.ascii_letters, k=16))}")
        client = TaskworkerClient(
            ["localhost-0:50051"],
            application="sentry",
            health_check_settings=HealthCheckSettings(health_check_path, 3),
        )
        _ = client.get_task()
        assert health_check_path.exists()


@django_db_all
def test_get_task_with_interceptor() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
        metadata=(
            (
                "sentry-signature",
                "556b2e74f2d5a1d0134b1f803c9bfaa8467bbd8e4cb510a9856c5e2ef2b66a21",
            ),
        ),
    )
    secret = '["a long secret value","notused"]'
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost-0:50051"], application="sentry", rpc_secret=secret)
        result = client.get_task()

        assert result
        assert result.host == "localhost-0:50051"
        assert result.activation.id
        assert result.activation.namespace == "testing"


@django_db_all
def test_get_task_with_namespace() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(
            hosts=make_broker_hosts("localhost:50051", num_brokers=1), application="sentry"
        )
        result = client.get_task(namespace="testing")

        assert result
        assert result.host == "localhost-0:50051"
        assert result.activation.id
        assert result.activation.namespace == "testing"


@django_db_all
def test_get_task_not_found() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending task found"),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost:50051"], application="sentry")
        result = client.get_task()

        assert result is None


@django_db_all
def test_get_task_failure() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.INTERNAL, "something bad"),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost:50051"], application="sentry")
        with pytest.raises(grpc.RpcError):
            client.get_task()


@django_db_all
def test_update_task_writes_to_health_check_file() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        health_check_path = Path(f"/tmp/{''.join(random.choices(string.ascii_letters, k=16))}")
        client = TaskworkerClient(
            make_broker_hosts("localhost:50051", num_brokers=1),
            application="sentry",
            health_check_settings=HealthCheckSettings(
                health_check_path, DEFAULT_WORKER_HEALTH_CHECK_SEC_PER_TOUCH
            ),
        )
        _ = client.update_task(
            ProcessingResult("abc123", TASK_ACTIVATION_STATUS_RETRY, "localhost-0:50051", 0),
            FetchNextTask(application="sentry", namespace=None),
        )
        assert health_check_path.exists()


@django_db_all
def test_update_task_ok_with_next() -> None:
    def update_task_response(request: SetTaskStatusRequest) -> SetTaskStatusResponse:
        assert request.fetch_next_task
        assert request.fetch_next_task.application == "sentry"
        assert request.fetch_next_task.namespace == ""

        return SetTaskStatusResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        )

    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        update_task_response,
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(
            make_broker_hosts("localhost:50051", num_brokers=1), application="sentry"
        )
        assert set(client._host_to_stubs.keys()) == {"localhost-0:50051"}
        result = client.update_task(
            ProcessingResult("abc123", TASK_ACTIVATION_STATUS_RETRY, "localhost-0:50051", 0),
            FetchNextTask(application="sentry", namespace=None),
        )

        assert result
        assert result.host == "localhost-0:50051"
        assert result.activation.id == "abc123"


@django_db_all
def test_update_task_ok_with_next_namespace() -> None:

    def update_task_response(request: SetTaskStatusRequest) -> SetTaskStatusResponse:
        assert request.fetch_next_task
        assert request.fetch_next_task.application == "sentry"
        assert request.fetch_next_task.namespace == "testing"

        return SetTaskStatusResponse(
            task=TaskActivation(
                id="abc123",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        )

    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        update_task_response,
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(
            make_broker_hosts("localhost:50051", num_brokers=1), application="sentry"
        )
        result = client.update_task(
            ProcessingResult(
                task_id="id",
                status=TASK_ACTIVATION_STATUS_RETRY,
                host="localhost-0:50051",
                receive_timestamp=0,
            ),
            FetchNextTask(application="sentry", namespace="testing"),
        )
        assert result
        assert result.activation.id == "abc123"
        assert result.activation.namespace == "testing"


@django_db_all
def test_update_task_ok_no_next() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus", SetTaskStatusResponse()
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(
            make_broker_hosts("localhost:50051", num_brokers=1), application="sentry"
        )
        result = client.update_task(
            ProcessingResult(
                task_id="abc123",
                status=TASK_ACTIVATION_STATUS_RETRY,
                host="localhost-0:50051",
                receive_timestamp=0,
            ),
            FetchNextTask(application="sentry", namespace=None),
        )
        assert result is None


@django_db_all
def test_update_task_not_found() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending tasks found"),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost-0:50051"], application="sentry")
        result = client.update_task(
            ProcessingResult(
                task_id="abc123",
                status=TASK_ACTIVATION_STATUS_RETRY,
                host="localhost-0:50051",
                receive_timestamp=0,
            ),
            FetchNextTask(application="sentry", namespace=None),
        )
        assert result is None


@django_db_all
def test_update_task_unavailable_retain_task_to_host() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "broker down"),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(["localhost-0:50051"], application="sentry")
        with pytest.raises(MockGrpcError) as err:
            client.update_task(
                ProcessingResult(
                    task_id="abc123",
                    status=TASK_ACTIVATION_STATUS_RETRY,
                    host="localhost-0:50051",
                    receive_timestamp=0,
                ),
                FetchNextTask(application="sentry", namespace=None),
            )
        assert "broker down" in str(err.value)


@django_db_all
def test_client_loadbalance() -> None:
    channel_0 = MockChannel()
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="0",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(task=None),
    )
    channel_1 = MockChannel()
    channel_1.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel_1.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(task=None),
    )
    channel_2 = MockChannel()
    channel_2.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="2",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel_2.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(task=None),
    )
    channel_3 = MockChannel()
    channel_3.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="3",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel_3.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        SetTaskStatusResponse(task=None),
    )
    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.side_effect = [channel_0, channel_1, channel_2, channel_3]
        with patch("sentry.taskworker.client.client.random.choice") as mock_randchoice:
            mock_randchoice.side_effect = [
                "localhost-0:50051",
                "localhost-1:50051",
                "localhost-2:50051",
                "localhost-3:50051",
            ]
            client = TaskworkerClient(
                hosts=make_broker_hosts(host_prefix="localhost:50051", num_brokers=4),
                application="sentry",
                max_tasks_before_rebalance=1,
            )

            task_0 = client.get_task()
            assert task_0 is not None and task_0.activation.id == "0"
            task_1 = client.get_task()
            assert task_1 is not None and task_1.activation.id == "1"
            task_2 = client.get_task()
            assert task_2 is not None and task_2.activation.id == "2"
            task_3 = client.get_task()
            assert task_3 is not None and task_3.activation.id == "3"

            client.update_task(
                ProcessingResult(
                    task_0.activation.id, TASK_ACTIVATION_STATUS_COMPLETE, task_0.host, 0
                ),
                None,
            )
            client.update_task(
                ProcessingResult(
                    task_1.activation.id, TASK_ACTIVATION_STATUS_COMPLETE, task_1.host, 0
                ),
                None,
            )
            client.update_task(
                ProcessingResult(
                    task_2.activation.id, TASK_ACTIVATION_STATUS_COMPLETE, task_2.host, 0
                ),
                None,
            )
            client.update_task(
                ProcessingResult(
                    task_3.activation.id, TASK_ACTIVATION_STATUS_COMPLETE, task_3.host, 0
                ),
                None,
            )


@django_db_all
def test_client_loadbalance_on_notfound() -> None:
    channel_0 = MockChannel()
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending task found"),
    )

    channel_1 = MockChannel()
    channel_1.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel_1.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/SetTaskStatus",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending task found"),
    )

    channel_2 = MockChannel()
    channel_2.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="2",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )

    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.side_effect = [channel_0, channel_1, channel_2]
        with patch("sentry.taskworker.client.client.random.choice") as mock_randchoice:
            mock_randchoice.side_effect = [
                "localhost-0:50051",
                "localhost-1:50051",
                "localhost-2:50051",
            ]
            client = TaskworkerClient(
                hosts=make_broker_hosts(host_prefix="localhost:50051", num_brokers=3),
                application="sentry",
                max_tasks_before_rebalance=30,
            )

            # Fetch from the first channel, it should return notfound
            task_0 = client.get_task()
            assert task_0 is None

            # Fetch again, this time from channel_1
            task_1 = client.get_task()
            assert task_1 and task_1.activation.id == "1"

            res = client.update_task(
                ProcessingResult(
                    task_1.activation.id, TASK_ACTIVATION_STATUS_COMPLETE, task_1.host, 0
                ),
                None,
            )
            assert res is None

            # Because SetStatus on channel_1 returned notfound the client
            # should switch brokers.
            task_2 = client.get_task()
            assert task_2 and task_2.activation.id == "2"


@django_db_all
def test_client_loadbalance_on_unavailable() -> None:
    channel_0 = MockChannel()
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel_0.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )

    channel_1 = MockChannel()
    channel_1.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )

    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.side_effect = [channel_0, channel_1]
        with patch("sentry.taskworker.client.client.random.choice") as mock_randchoice:
            mock_randchoice.side_effect = [
                "localhost-0:50051",
                "localhost-1:50051",
            ]
            client = TaskworkerClient(
                hosts=make_broker_hosts(host_prefix="localhost:50051", num_brokers=2),
                application="sentry",
                max_consecutive_unavailable_errors=3,
            )

            # Fetch from the first channel, host should be unavailable
            with pytest.raises(grpc.RpcError, match="host is unavailable"):
                client.get_task()
            assert client._num_consecutive_unavailable_errors == 1

            # Fetch from the first channel, host should be unavailable
            with pytest.raises(grpc.RpcError, match="host is unavailable"):
                client.get_task()
            assert client._num_consecutive_unavailable_errors == 2

            # Fetch from the first channel, host should be unavailable
            with pytest.raises(grpc.RpcError, match="host is unavailable"):
                client.get_task()
            assert client._num_consecutive_unavailable_errors == 3

            # Should rebalance to the second host and receive task
            task = client.get_task()
            assert task and task.activation.id == "1"
            assert client._num_consecutive_unavailable_errors == 0


@django_db_all
def test_client_single_host_unavailable() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )

    with (patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel,):
        mock_channel.return_value = channel
        client = TaskworkerClient(
            hosts=["localhost-0:50051"],
            application="sentry",
            max_consecutive_unavailable_errors=3,
            temporary_unavailable_host_timeout=2,
        )

        for _ in range(3):
            with pytest.raises(grpc.RpcError, match="host is unavailable"):
                client.get_task()
        assert client._num_consecutive_unavailable_errors == 3

        # Verify host was marked as temporarily unavailable
        assert "localhost-0:50051" in client._temporary_unavailable_hosts
        assert isinstance(client._temporary_unavailable_hosts["localhost-0:50051"], float)

        client.get_task()
        assert client._cur_host == "localhost-0:50051"


@django_db_all
def test_client_reset_errors_after_success() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )

    with patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient(
            ["localhost:50051"], application="sentry", max_consecutive_unavailable_errors=3
        )

        with pytest.raises(grpc.RpcError, match="host is unavailable"):
            client.get_task()
        assert client._num_consecutive_unavailable_errors == 1

        task = client.get_task()
        assert task and task.activation.id == "1"
        assert client._num_consecutive_unavailable_errors == 0

        with pytest.raises(grpc.RpcError, match="host is unavailable"):
            client.get_task()
        assert client._num_consecutive_unavailable_errors == 1


@django_db_all
def test_client_update_task_host_unavailable() -> None:
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        GetTaskResponse(
            task=TaskActivation(
                id="1",
                namespace="testing",
                taskname="do_thing",
                parameters="",
                headers={},
                processing_deadline_duration=10,
            )
        ),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )
    channel.add_response(
        "/sentry_protos.taskbroker.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.UNAVAILABLE, "host is unavailable"),
    )

    current_time = 1000.0

    def mock_time():
        return current_time

    with (
        patch("sentry.taskworker.client.client.grpc.insecure_channel") as mock_channel,
        patch("sentry.taskworker.client.client.time.time", side_effect=mock_time),
    ):
        mock_channel.return_value = channel
        client = TaskworkerClient(
            ["localhost:50051"],
            application="sentry",
            max_consecutive_unavailable_errors=3,
            temporary_unavailable_host_timeout=10,
        )

        # Get a task to establish the host mapping
        task = client.get_task()
        assert task and task.activation.id == "1"
        host = task.host

        # Make the host temporarily unavailable
        for _ in range(3):
            with pytest.raises(grpc.RpcError, match="host is unavailable"):
                client.get_task()
        assert client._num_consecutive_unavailable_errors == 3
        assert host in client._temporary_unavailable_hosts

        # Try to update the task
        with pytest.raises(
            HostTemporarilyUnavailable, match=f"Host: {host} is temporarily unavailable"
        ):
            client.update_task(
                ProcessingResult(
                    task_id="1",
                    status=TASK_ACTIVATION_STATUS_COMPLETE,
                    host=host,
                    receive_timestamp=0,
                ),
                fetch_next_task=None,
            )
