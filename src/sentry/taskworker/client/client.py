import hashlib
import hmac
import logging
import random
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import grpc
from google.protobuf.message import Message
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    AddWorkerRequest,
    FetchNextTask,
    GetTaskRequest,
    RemoveWorkerRequest,
    SetTaskStatusRequest,
)
from sentry_protos.taskbroker.v1.taskbroker_pb2_grpc import ConsumerServiceStub

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


def make_broker_hosts(
    host_prefix: str,
    num_brokers: int | None,
    host_list: str | None = None,
) -> list[str]:
    """
    Handle RPC host CLI options and create a list of broker host:ports
    """
    if host_list:
        stripped = map(lambda x: x.strip(), host_list.split(","))
        return list(filter(lambda x: len(x), stripped))
    if not num_brokers:
        return [host_prefix]
    domain, port = host_prefix.split(":")
    return [f"{domain}-{i}:{port}" for i in range(0, num_brokers)]


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


@dataclass
class HealthCheckSettings:
    file_path: Path
    touch_interval_sec: float


class TaskworkerClient:
    """
    Taskworker RPC client wrapper

    When num_brokers is provided, the client will connect to all brokers
    and choose a new broker to pair with randomly every max_tasks_before_rebalance tasks.
    """

    def __init__(
        self,
        hosts: list[str],
        max_tasks_before_rebalance: int = DEFAULT_REBALANCE_AFTER,
        max_consecutive_unavailable_errors: int = DEFAULT_CONSECUTIVE_UNAVAILABLE_ERRORS,
        temporary_unavailable_host_timeout: int = DEFAULT_TEMPORARY_UNAVAILABLE_HOST_TIMEOUT,
        health_check_settings: HealthCheckSettings | None = None,
        rpc_secret: str | None = None,
        grpc_config: str | None = None,
        port: int = 50052,
    ) -> None:
        assert len(hosts) > 0, "You must provide at least one RPC host to connect to"
        self._hosts = hosts
        self._rpc_secret = rpc_secret
        self._port = port

        self._grpc_options: list[tuple[str, Any]] = [
            ("grpc.max_receive_message_length", MAX_ACTIVATION_SIZE)
        ]
        if grpc_config:
            self._grpc_options.append(("grpc.service_config", grpc_config))

        logger.info(
            "taskworker.client.start", extra={"hosts": hosts, "options": self._grpc_options}
        )

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

        self._health_check_settings = health_check_settings
        self._timestamp_since_touch_lock = threading.Lock()
        self._timestamp_since_touch = 0.0

    def _emit_health_check(self) -> None:
        if self._health_check_settings is None:
            return

        with self._timestamp_since_touch_lock:
            cur_time = time.time()
            if (
                cur_time - self._timestamp_since_touch
                < self._health_check_settings.touch_interval_sec
            ):
                return

            self._health_check_settings.file_path.touch()
            metrics.incr(
                "taskworker.client.health_check.touched",
            )
            self._timestamp_since_touch = cur_time

    def _connect_to_host(self, host: str) -> ConsumerServiceStub:
        logger.info("taskworker.client.connect", extra={"host": host})
        channel = grpc.insecure_channel(host, options=self._grpc_options)
        if self._rpc_secret:
            secrets = json.loads(self._rpc_secret)
            channel = grpc.intercept_channel(channel, RequestSignatureInterceptor(secrets))
        return ConsumerServiceStub(channel)

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
        self._emit_health_check()

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
        self._emit_health_check()

        metrics.incr("taskworker.client.fetch_next", tags={"next": fetch_next_task is not None})
        self._clear_temporary_unavailable_hosts()
        request = SetTaskStatusRequest(
            id=processing_result.task_id,
            status=processing_result.status,
            fetch_next_task=fetch_next_task,
            address=f"http://127.0.0.1:{self._port}",
        )

        try:
            if processing_result.host in self._temporary_unavailable_hosts:
                metrics.incr(
                    "taskworker.client.skipping_set_task_due_to_unavailable_host",
                    tags={"broker_host": processing_result.host},
                )
                raise HostTemporarilyUnavailable(
                    f"Host: {processing_result.host} is temporarily unavailable"
                )

            with metrics.timer("taskworker.update_task.rpc", tags={"host": processing_result.host}):
                logger.debug(
                    "Calling set task status",
                    extra={
                        "task_id": processing_result.task_id,
                        "status": processing_result.status,
                        "host": processing_result.host,
                        "receive_timestamp": processing_result.receive_timestamp,
                    },
                )
                start_time = time.time()
                response = self._host_to_stubs[processing_result.host].SetTaskStatus(request)
                duration_ms = (time.time() - start_time) * 1000
                logger.debug(
                    "Done setting task status",
                    extra={"duration_ms": duration_ms},
                )
        except grpc.RpcError as err:
            logger.warning("Failed to perform RPC - %s", err)
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

    def add_worker(self, host: str, address: str) -> None:
        """
        Register this worker with a taskbroker.

        Sends an AddWorker message to notify the broker that this worker
        is available to receive tasks.
        """
        # Ensure we have a connection to this host
        if host not in self._host_to_stubs:
            self._host_to_stubs[host] = self._connect_to_host(host)

        request = AddWorkerRequest(address=address)

        try:
            with metrics.timer("taskworker.add_worker.rpc", tags={"host": host}):
                self._host_to_stubs[host].AddWorker(request)
            logger.info(
                "taskworker.client.add_worker.success",
                extra={"host": host, "address": address},
            )
            metrics.incr("taskworker.client.add_worker.success", tags={"host": host})
        except grpc.RpcError as err:
            logger.warning(
                "taskworker.client.add_worker.failed",
                extra={"host": host, "error": str(err), "status": err.code().name},
            )
            metrics.incr(
                "taskworker.client.rpc_error",
                tags={"method": "AddWorker", "status": err.code().name},
            )

    def remove_worker(self, host: str, address: str) -> None:
        """
        Unregister this worker from a taskbroker.

        Sends a RemoveWorker message to notify the broker that this worker
        is shutting down and should no longer receive tasks.
        """
        if host not in self._host_to_stubs:
            logger.warning(
                "taskworker.client.remove_worker.unknown_host",
                extra={"host": host},
            )
            return

        request = RemoveWorkerRequest(address=address)

        try:
            with metrics.timer("taskworker.remove_worker.rpc", tags={"host": host}):
                self._host_to_stubs[host].RemoveWorker(request)
            logger.info(
                "taskworker.client.remove_worker.success",
                extra={"host": host, "address": address},
            )
            metrics.incr("taskworker.client.remove_worker.success", tags={"host": host})
        except grpc.RpcError as err:
            logger.warning(
                "taskworker.client.remove_worker.failed",
                extra={"host": host, "error": str(err), "status": err.code().name},
            )
            metrics.incr(
                "taskworker.client.rpc_error",
                tags={"method": "RemoveWorker", "status": err.code().name},
            )
