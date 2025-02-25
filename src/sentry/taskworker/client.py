import hashlib
import hmac
import logging
import random
from collections.abc import Callable
from datetime import datetime
from typing import Any

import grpc
from django.conf import settings
from google.protobuf.message import Message
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    FetchNextTask,
    GetTaskRequest,
    SetTaskStatusRequest,
    TaskActivation,
    TaskActivationStatus,
)
from sentry_protos.taskbroker.v1.taskbroker_pb2_grpc import ConsumerServiceStub

from sentry import options
from sentry.utils import metrics

logger = logging.getLogger("sentry.taskworker.client")


class ClientCallDetails(grpc.ClientCallDetails):
    """
    Subclass of grpc.ClientCallDetails that allows metadata to be updated
    """

    def __init__(
        self,
        method: str,
        timeout: float | None,
        metadata: tuple[tuple[str, str | bytes], ...] | None,
        credentials: grpc.CallCredentials | None,
    ):
        self.timeout = timeout
        self.method = method
        self.metadata = metadata
        self.credentials = credentials


# Type alias based on grpc-stubs
ContinuationType = Callable[[ClientCallDetails, Message], Any]


# The type stubs for grpc.UnaryUnaryClientInterceptor have generics
# but the implementation in grpc does not, and providing the type parameters
# results in a runtime error.
class RequestSignatureInterceptor(grpc.UnaryUnaryClientInterceptor):  # type: ignore[type-arg]
    def __init__(self, shared_secret: str):
        self._secret = shared_secret.encode("utf-8")

    def intercept_unary_unary(
        self,
        continuation: ContinuationType,
        client_call_details: grpc.ClientCallDetails,
        request: Message,
    ) -> Any:
        request_body = request.SerializeToString()
        method = client_call_details.method.encode("utf-8")

        signing_payload = method + b":" + request_body
        signature = hmac.new(self._secret, signing_payload, hashlib.sha256).hexdigest()

        metadata = list(client_call_details.metadata) if client_call_details.metadata else []
        metadata.append(("sentry-signature", signature))

        call_details_with_meta = ClientCallDetails(
            client_call_details.method,
            client_call_details.timeout,
            tuple(metadata),
            client_call_details.credentials,
        )
        return continuation(call_details_with_meta, request)


class TaskworkerClient:
    """
    Taskworker RPC client wrapper
    """

    def __init__(self, host: str, num_brokers: int | None) -> None:
        self._host = host if not num_brokers else self.loadbalance(host, num_brokers)

        # TODO(taskworker) Need to support xds bootstrap file
        grpc_config = options.get("taskworker.grpc_service_config")
        grpc_options = []
        if grpc_config:
            grpc_options = [("grpc.service_config", grpc_config)]

        logger.info("Connecting to %s with options %s", self._host, grpc_options)
        channel = grpc.insecure_channel(self._host, options=grpc_options)
        if settings.TASKWORKER_SHARED_SECRET:
            channel = grpc.intercept_channel(
                channel, RequestSignatureInterceptor(settings.TASKWORKER_SHARED_SECRET)
            )
        self._channel = channel
        self._stub = ConsumerServiceStub(self._channel)

    def loadbalance(self, host: str, num_brokers: int) -> str:
        """
        This function can be used to determine which broker a particular taskworker should connect to.
        Currently it selects a random broker and connects to it.

        This assumes that the passed in port is of the form broker:port, where broker corresponds to the
        headless service of the brokers.
        """
        domain, port = host.split(":")
        random.seed(datetime.now().microsecond)
        broker_index = random.randint(0, num_brokers - 1)
        return f"{domain}-{broker_index}:{port}"

    def get_task(self, namespace: str | None = None) -> TaskActivation | None:
        """
        Fetch a pending task.

        If a namespace is provided, only tasks for that namespace will be fetched.
        This will return None if there are no tasks to fetch.
        """
        request = GetTaskRequest(namespace=namespace)
        try:
            with metrics.timer("taskworker.get_task.rpc"):
                response = self._stub.GetTask(request)
        except grpc.RpcError as err:
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
        if response.HasField("task"):
            return response.task
        return None

    def update_task(
        self,
        task_id: str,
        status: TaskActivationStatus.ValueType,
        fetch_next_task: FetchNextTask | None = None,
    ) -> TaskActivation | None:
        """
        Update the status for a given task activation.

        The return value is the next task that should be executed.
        """
        request = SetTaskStatusRequest(
            id=task_id,
            status=status,
            fetch_next_task=fetch_next_task,
        )
        try:
            with metrics.timer("taskworker.update_task.rpc"):
                response = self._stub.SetTaskStatus(request)
        except grpc.RpcError as err:
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
        if response.HasField("task"):
            return response.task
        return None
