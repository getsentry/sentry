from collections import defaultdict
from collections.abc import Callable
from typing import Any
from unittest.mock import patch

import grpc
import pytest
from google.protobuf.message import Message
from sentry_protos.sentry.v1.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_RETRY,
    GetTaskResponse,
    SetTaskStatusResponse,
    TaskActivation,
)

from sentry.taskworker.client import TaskworkerClient


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

        if isinstance(res, Exception):
            raise res
        return res


class MockChannel:
    def __init__(self):
        self._responses = defaultdict(list)

    def unary_unary(
        self, path: str, request_serializer: Callable, response_deserializer: Callable, **kwargs
    ):
        return MockServiceMethod(
            path, self._responses.get(path, []), request_serializer, response_deserializer
        )

    def add_response(self, path: str, resp: Message | Exception):
        self._responses[path].append(resp)


class MockGrpcError(grpc.RpcError):
    """Grpc error are elusive and this mock simulates the interface in mypy stubs"""

    def __init__(self, code, message):
        self._code = code
        self._message = message

    def code(self) -> grpc.StatusCode:
        return self._code

    def details(self) -> str:
        return self._message


def test_get_task_ok():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/GetTask",
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
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        result = client.get_task()

        assert result
        assert result.id
        assert result.namespace == "testing"


def test_get_task_not_found():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending task found"),
    )
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        result = client.get_task()

        assert result is None


def test_get_task_failure():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/GetTask",
        MockGrpcError(grpc.StatusCode.INTERNAL, "something bad"),
    )
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        with pytest.raises(grpc.RpcError):
            client.get_task()


def test_update_task_ok_with_next():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/SetTaskStatus",
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
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        result = client.update_task("abc123", TASK_ACTIVATION_STATUS_RETRY)
        assert result
        assert result.id == "abc123"


def test_update_task_ok_no_next():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/SetTaskStatus", SetTaskStatusResponse()
    )
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        result = client.update_task("abc123", TASK_ACTIVATION_STATUS_RETRY)
        assert result is None


def test_update_task_not_found():
    channel = MockChannel()
    channel.add_response(
        "/sentry_protos.sentry.v1.ConsumerService/SetTaskStatus",
        MockGrpcError(grpc.StatusCode.NOT_FOUND, "no pending tasks found"),
    )
    with patch("sentry.taskworker.client.grpc.insecure_channel") as mock_channel:
        mock_channel.return_value = channel
        client = TaskworkerClient("localhost:50051")
        result = client.update_task("abc123", TASK_ACTIVATION_STATUS_RETRY)
        assert result is None
