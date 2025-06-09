import hashlib
import hmac
import logging
import random
import time
from collections.abc import Callable
from typing import TYPE_CHECKING, Any

import grpc
from django.conf import settings
from google.protobuf.message import Message
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    FetchNextTask,
    GetTaskRequest,
    SetTaskStatusRequest,
)
from sentry_protos.taskbroker.v1.taskbroker_pb2_grpc import ConsumerServiceStub

from sentry import options
from sentry.taskworker.client.inflight_task_activation import InflightTaskActivation
from sentry.taskworker.client.processing_result import ProcessingResult
from sentry.taskworker.constants import (
    DEFAULT_CONSECUTIVE_UNAVAILABLE_ERRORS,
    DEFAULT_REBALANCE_AFTER,
    DEFAULT_TEMPORARY_UNAVAILABLE_HOST_TIMEOUT,
)
from sentry.utils import json, metrics

logger = logging.getLogger("sentry.taskworker.client")

MAX_ACTIVATION_SIZE = 1024 * 1024 * 10
"""Max payload size we will process."""


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


class HostTemporarilyUnavailable(Exception):
    """Raised when a host is temporarily unavailable and should be retried later."""

    pass


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
        max_consecutive_unavailable_errors: int = DEFAULT_CONSECUTIVE_UNAVAILABLE_ERRORS,
        temporary_unavailable_host_timeout: int = DEFAULT_TEMPORARY_UNAVAILABLE_HOST_TIMEOUT,
    ) -> None:
        self._hosts: list[str] = (
            [host] if not num_brokers else self._get_all_hosts(host, num_brokers)
        )

        grpc_config = options.get("taskworker.grpc_service_config")
        self._grpc_options: list[tuple[str, Any]] = [
            ("grpc.max_receive_message_length", MAX_ACTIVATION_SIZE)
        ]
        if grpc_config:
            self._grpc_options.append(("grpc.service_config", grpc_config))

        self._cur_host = random.choice(self._hosts)
        self._host_to_stubs: dict[str, ConsumerServiceStub] = {
            self._cur_host: self._connect_to_host(self._cur_host)
        }

        self._max_tasks_before_rebalance = max_tasks_before_rebalance
        self._num_tasks_before_rebalance = max_tasks_before_rebalance

        self._max_consecutive_unavailable_errors = max_consecutive_unavailable_errors
        self._num_consecutive_unavailable_errors = 0

        self._temporary_unavailable_hosts: dict[str, float] = {}
        self._temporary_unavailable_host_timeout = temporary_unavailable_host_timeout

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

    def _check_consecutive_unavailable_errors(self) -> None:
        if self._num_consecutive_unavailable_errors >= self._max_consecutive_unavailable_errors:
            self._temporary_unavailable_hosts[self._cur_host] = (
                time.time() + self._temporary_unavailable_host_timeout
            )

    def _clear_temporary_unavailable_hosts(self) -> None:
        hosts_to_remove = []
        for host, timeout in self._temporary_unavailable_hosts.items():
            if time.time() >= timeout:
                hosts_to_remove.append(host)

        for host in hosts_to_remove:
            self._temporary_unavailable_hosts.pop(host)

    def _get_cur_stub(self) -> tuple[str, ConsumerServiceStub]:
        self._clear_temporary_unavailable_hosts()
        available_hosts = [h for h in self._hosts if h not in self._temporary_unavailable_hosts]
        if not available_hosts:
            # If all hosts are temporarily unavailable, wait for the shortest timeout
            current_time = time.time()
            shortest_timeout = min(self._temporary_unavailable_hosts.values())
            logger.info(
                "taskworker.client.no_available_hosts",
                extra={"sleeping for": shortest_timeout - current_time},
            )
            time.sleep(shortest_timeout - current_time)
            return self._get_cur_stub()  # try again

        if self._cur_host in self._temporary_unavailable_hosts:
            self._cur_host = random.choice(available_hosts)
            self._num_tasks_before_rebalance = self._max_tasks_before_rebalance
            self._num_consecutive_unavailable_errors = 0
            metrics.incr(
                "taskworker.client.loadbalancer.rebalance",
                tags={"reason": "unavailable_count_reached"},
            )
        elif self._num_tasks_before_rebalance == 0:
            self._cur_host = random.choice(available_hosts)
            self._num_tasks_before_rebalance = self._max_tasks_before_rebalance
            self._num_consecutive_unavailable_errors = 0
            metrics.incr(
                "taskworker.client.loadbalancer.rebalance",
                tags={"reason": "max_tasks_reached"},
            )

        if self._cur_host not in self._host_to_stubs:
            self._host_to_stubs[self._cur_host] = self._connect_to_host(self._cur_host)

        self._num_tasks_before_rebalance -= 1
        return self._cur_host, self._host_to_stubs[self._cur_host]

    def get_task(self, namespace: str | None = None) -> InflightTaskActivation | None:
        """
        Fetch a pending task.

        If a namespace is provided, only tasks for that namespace will be fetched.
        This will return None if there are no tasks to fetch.
        """
        request = GetTaskRequest(namespace=namespace)
        try:
            host, stub = self._get_cur_stub()
            with metrics.timer("taskworker.get_task.rpc", tags={"host": host}):
                response = stub.GetTask(request)
        except grpc.RpcError as err:
            metrics.incr(
                "taskworker.client.rpc_error", tags={"method": "GetTask", "status": err.code().name}
            )
            if err.code() == grpc.StatusCode.NOT_FOUND:
                # Because our current broker doesn't have any tasks, try rebalancing.
                self._num_tasks_before_rebalance = 0
                return None
            if err.code() == grpc.StatusCode.UNAVAILABLE:
                self._num_consecutive_unavailable_errors += 1
                self._check_consecutive_unavailable_errors()
            raise
        self._num_consecutive_unavailable_errors = 0
        self._temporary_unavailable_hosts.pop(host, None)
        if response.HasField("task"):
            metrics.incr(
                "taskworker.client.get_task",
                tags={"namespace": response.task.namespace},
            )
            return InflightTaskActivation(
                activation=response.task, host=host, receive_timestamp=time.monotonic()
            )
        return None

    def update_task(
        self,
        processing_result: ProcessingResult,
        fetch_next_task: FetchNextTask | None = None,
    ) -> InflightTaskActivation | None:
        """
        Update the status for a given task activation.

        The return value is the next task that should be executed.
        """
        metrics.incr("taskworker.client.fetch_next", tags={"next": fetch_next_task is not None})
        self._clear_temporary_unavailable_hosts()
        request = SetTaskStatusRequest(
            id=processing_result.task_id,
            status=processing_result.status,
            fetch_next_task=fetch_next_task,
        )

        try:
            if processing_result.host in self._temporary_unavailable_hosts:
                metrics.incr("taskworker.client.skipping_update_due_to_unavailable_host")
                raise HostTemporarilyUnavailable(
                    f"Host: {processing_result.host} is temporarily unavailable"
                )

            with metrics.timer("taskworker.update_task.rpc", tags={"host": processing_result.host}):
                response = self._host_to_stubs[processing_result.host].SetTaskStatus(request)
        except grpc.RpcError as err:
            metrics.incr(
                "taskworker.client.rpc_error",
                tags={"method": "SetTaskStatus", "status": err.code().name},
            )
            if err.code() == grpc.StatusCode.NOT_FOUND:
                # The current broker is empty, switch.
                self._num_tasks_before_rebalance = 0

                return None
            if err.code() == grpc.StatusCode.UNAVAILABLE:
                self._num_consecutive_unavailable_errors += 1
                self._check_consecutive_unavailable_errors()
            raise

        self._num_consecutive_unavailable_errors = 0
        self._temporary_unavailable_hosts.pop(processing_result.host, None)
        if response.HasField("task"):
            return InflightTaskActivation(
                activation=response.task,
                host=processing_result.host,
                receive_timestamp=time.monotonic(),
            )
        return None
