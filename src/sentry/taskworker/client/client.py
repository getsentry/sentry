import hashlib
import hmac
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import grpc
from google.protobuf.message import Message
from sentry_protos.taskbroker.v1.taskbroker_pb2 import FetchNextTask, SetTaskStatusRequest
from sentry_protos.taskbroker.v1.taskbroker_pb2_grpc import ConsumerServiceStub

from sentry.taskworker.client.inflight_task_activation import InflightTaskActivation
from sentry.taskworker.client.processing_result import ProcessingResult
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


@dataclass
class HealthCheckSettings:
    file_path: Path
    touch_interval_sec: float


class TaskworkerClient:
    """
    Client for sending task results back to broker callback URLs.
    Stubs are created lazily per callback URL when SetTaskStatus is called.
    """

    def __init__(
        self,
        hosts: list[str],
        health_check_settings: HealthCheckSettings | None = None,
        rpc_secret: str | None = None,
        grpc_config: str | None = None,
        port: int = 50052,
    ) -> None:
        self._hosts = list(hosts)
        self._rpc_secret = rpc_secret
        self._port = port

        self._grpc_options: list[tuple[str, Any]] = [
            ("grpc.max_receive_message_length", MAX_ACTIVATION_SIZE)
        ]
        if grpc_config:
            self._grpc_options.append(("grpc.service_config", grpc_config))

        logger.info(
            "taskworker.client.start", extra={"hosts": self._hosts, "options": self._grpc_options}
        )

        self._host_to_stubs: dict[str, ConsumerServiceStub] = {
            host: self._connect_to_host(host) for host in self._hosts
        }
        self._host_to_stubs_lock = threading.Lock()

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

    def _get_stub(self, host: str) -> ConsumerServiceStub:
        with self._host_to_stubs_lock:
            if host not in self._host_to_stubs:
                self._host_to_stubs[host] = self._connect_to_host(host)
            return self._host_to_stubs[host]

    def get_task(self, namespace: str | None = None) -> InflightTaskActivation | None:
        """Push-only: tasks arrive via PushTask. Returns None."""
        self._emit_health_check()
        return None

    def update_task(
        self,
        processing_result: ProcessingResult,
        fetch_next_task: FetchNextTask | None = None,
    ) -> InflightTaskActivation | None:
        """Send task status to the callback URL (host). Creates stub lazily if needed."""
        self._emit_health_check()

        request = SetTaskStatusRequest(
            id=processing_result.task_id,
            status=processing_result.status,
            fetch_next_task=fetch_next_task,
        )

        stub = self._get_stub(processing_result.host)
        with metrics.timer("taskworker.update_task.rpc", tags={"host": processing_result.host}):
            response = stub.SetTaskStatus(request)

        if response.HasField("task"):
            return InflightTaskActivation(
                activation=response.task,
                host=processing_result.host,
                receive_timestamp=time.monotonic(),
            )
        return None
