import hashlib
import hmac
import logging
import random
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

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
from sentry.taskworker.constants import DEFAULT_REBALANCE_AFTER
from sentry.utils import json, metrics

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


if TYPE_CHECKING:
    InterceptorBase = grpc.UnaryUnaryClientInterceptor[Message, Message]
    CallFuture = grpc.CallFuture[Message]
else:
    InterceptorBase = grpc.UnaryUnaryClientInterceptor
    CallFuture = Any


class RequestSignatureInterceptor(InterceptorBase):
    def __init__(self, shared_secret: list[str]):
        self._secret = shared_secret[0].encode("utf-8")

    def intercept_unary_unary(
        self,
        continuation: ContinuationType,
        client_call_details: grpc.ClientCallDetails,
        request: Message,
    ) -> CallFuture:
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

    When num_brokers is provided, the client will connect to all brokers
    and choose a new broker to pair with randomly every max_tasks_before_rebalance tasks.
    """

    def __init__(
        self,
        host: str,
        num_brokers: int | None = None,
        max_tasks_before_rebalance: int = DEFAULT_REBALANCE_AFTER,
    ) -> None:
        self._hosts: list[str] = (
            [host] if not num_brokers else self._get_all_hosts(host, num_brokers)
        )

        grpc_config = options.get("taskworker.grpc_service_config")
        self._grpc_options = []
        if grpc_config:
            self._grpc_options = [("grpc.service_config", grpc_config)]

        self._cur_host = random.choice(self._hosts)
        self._host_to_stubs: dict[str, ConsumerServiceStub] = {
            self._cur_host: self._connect_to_host(self._cur_host)
        }
        self._task_id_to_host: dict[str, str] = {}

        self._max_tasks_before_rebalance = max_tasks_before_rebalance
        self._num_tasks_before_rebalance = max_tasks_before_rebalance

    def _connect_to_host(self, host: str) -> ConsumerServiceStub:
        logger.info("Connecting to %s with options %s", host, self._grpc_options)
        channel = grpc.insecure_channel(host, options=self._grpc_options)
        if settings.TASKWORKER_SHARED_SECRET:
            secrets = json.loads(settings.TASKWORKER_SHARED_SECRET)
            channel = grpc.intercept_channel(channel, RequestSignatureInterceptor(secrets))
        return ConsumerServiceStub(channel)

    def _get_all_hosts(self, pattern: str, num_brokers: int) -> list[str]:
        """
        This function is used to determine the individual host names of
        the broker given their headless service name.

        This assumes that the passed in port is of the form broker:port,
        where broker corresponds to the headless service of the brokers.
        """
        domain, port = pattern.split(":")
        return [f"{domain}-{i}:{port}" for i in range(0, num_brokers)]

    def _get_cur_stub(self) -> tuple[str, ConsumerServiceStub]:
        if self._num_tasks_before_rebalance == 0:
            self._cur_host = random.choice(self._hosts)
            self._num_tasks_before_rebalance = self._max_tasks_before_rebalance

        if self._cur_host not in self._host_to_stubs:
            self._host_to_stubs[self._cur_host] = self._connect_to_host(self._cur_host)

        self._num_tasks_before_rebalance -= 1
        return self._cur_host, self._host_to_stubs[self._cur_host]

    def get_task(self, namespace: str | None = None) -> TaskActivation | None:
        """
        Fetch a pending task.

        If a namespace is provided, only tasks for that namespace will be fetched.
        This will return None if there are no tasks to fetch.
        """
        request = GetTaskRequest(namespace=namespace)
        try:
            with metrics.timer("taskworker.get_task.rpc"):
                host, stub = self._get_cur_stub()
                response = stub.GetTask(request)
        except grpc.RpcError as err:
            metrics.incr(
                "taskworker.client.rpc_error", tags={"method": "GetTask", "status": err.code().name}
            )
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
        if response.HasField("task"):
            metrics.incr(
                "taskworker.client.get_task",
                tags={"namespace": response.task.namespace},
            )
            self._task_id_to_host[response.task.id] = host
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
        metrics.incr("taskworker.client.fetch_next", tags={"next": fetch_next_task is not None})
        request = SetTaskStatusRequest(
            id=task_id,
            status=status,
            fetch_next_task=fetch_next_task,
        )
        try:
            with metrics.timer("taskworker.update_task.rpc"):
                if task_id not in self._task_id_to_host:
                    metrics.incr("taskworker.client.task_id_not_in_client")
                    return None
                host = self._task_id_to_host.pop(task_id)
                response = self._host_to_stubs[host].SetTaskStatus(request)
        except grpc.RpcError as err:
            metrics.incr(
                "taskworker.client.rpc_error",
                tags={"method": "SetTaskStatus", "status": err.code().name},
            )
            if err.code() == grpc.StatusCode.NOT_FOUND:
                return None
            raise
        if response.HasField("task"):
            self._task_id_to_host[response.task.id] = host
            return response.task
        return None
