from __future__ import annotations

import base64
import datetime
import time
from collections.abc import Callable, Collection, Mapping, MutableMapping
from functools import update_wrapper
from typing import TYPE_CHECKING, Any, Generic, ParamSpec, TypeVar
from uuid import uuid4

import orjson
import sentry_sdk
import zstandard as zstd
from django.conf import settings
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    ON_ATTEMPTS_EXCEEDED_DISCARD,
    RetryState,
    TaskActivation,
)

from sentry.taskworker.constants import (
    DEFAULT_PROCESSING_DEADLINE,
    MAX_PARAMETER_BYTES_BEFORE_COMPRESSION,
    CompressionType,
)
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.taskworker.registry import TaskNamespace


P = ParamSpec("P")
R = TypeVar("R")


class Task(Generic[P, R]):
    def __init__(
        self,
        name: str,
        func: Callable[P, R],
        namespace: TaskNamespace,
        retry: Retry | None = None,
        expires: int | datetime.timedelta | None = None,
        processing_deadline_duration: int | datetime.timedelta | None = None,
        at_most_once: bool = False,
        wait_for_delivery: bool = False,
        compression_type: CompressionType = CompressionType.PLAINTEXT,
    ):
        self.name = name
        self._func = func
        self._namespace = namespace
        self._expires = expires
        self._processing_deadline_duration = (
            processing_deadline_duration or DEFAULT_PROCESSING_DEADLINE
        )
        if at_most_once and retry:
            raise AssertionError(
                """
                You cannot enable at_most_once and have retries defined.
                Having retries enabled means that a task supports being executed
                multiple times and thus cannot be idempotent.
                """
            )
        self._retry = retry
        self.at_most_once = at_most_once
        self.wait_for_delivery = wait_for_delivery
        self.compression_type = compression_type
        update_wrapper(self, func)

    @property
    def fullname(self) -> str:
        return f"{self._namespace.name}:{self.name}"

    @property
    def namespace(self) -> TaskNamespace:
        return self._namespace

    @property
    def retry(self) -> Retry | None:
        return self._retry

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        """
        Call the task function immediately.
        """
        return self._func(*args, **kwargs)

    def delay(self, *args: P.args, **kwargs: P.kwargs) -> None:
        """
        Schedule a task to run later with a set of arguments.

        The provided parameters will be JSON encoded and stored within
        a `TaskActivation` protobuf that is appended to kafka
        """
        self.apply_async(args=args, kwargs=kwargs)

    def apply_async(
        self,
        args: Any | None = None,
        kwargs: Any | None = None,
        headers: MutableMapping[str, Any] | None = None,
        expires: int | datetime.timedelta | None = None,
        countdown: int | datetime.timedelta | None = None,
        **options: Any,
    ) -> None:
        """
        Schedule a task to run later with a set of arguments.

        The provided parameters will be JSON encoded and stored within
        a `TaskActivation` protobuf that is appended to kafka.
        """
        if args is None:
            args = []
        if kwargs is None:
            kwargs = {}

        self._signal_send(task=self, args=args, kwargs=kwargs)

        # Generate an activation even if we're in immediate mode to
        # catch serialization errors in tests.
        activation = self.create_activation(
            args=args, kwargs=kwargs, headers=headers, expires=expires, countdown=countdown
        )
        if settings.TASKWORKER_ALWAYS_EAGER:
            self._func(*args, **kwargs)
        else:
            # TODO(taskworker) promote parameters to headers
            self._namespace.send_task(
                activation,
                wait_for_delivery=self.wait_for_delivery,
            )

    def _signal_send(self, task: Task[Any, Any], args: Any, kwargs: Any) -> None:
        """
        This method is a stub that sentry.testutils.task_runner.BurstRunner or other testing
        hooks can monkeypatch to capture tasks that are being produced.
        """
        pass

    def create_activation(
        self,
        args: Collection[Any],
        kwargs: Mapping[Any, Any],
        headers: MutableMapping[str, Any] | None = None,
        expires: int | datetime.timedelta | None = None,
        countdown: int | datetime.timedelta | None = None,
    ) -> TaskActivation:
        received_at = Timestamp()
        received_at.FromDatetime(timezone.now())

        processing_deadline = self._processing_deadline_duration
        if isinstance(processing_deadline, datetime.timedelta):
            processing_deadline = int(processing_deadline.total_seconds())

        if expires is None:
            expires = self._expires
        if isinstance(expires, datetime.timedelta):
            expires = int(expires.total_seconds())

        if isinstance(countdown, datetime.timedelta):
            countdown = int(countdown.total_seconds())

        if not headers:
            headers = {}

        if headers.get("sentry-propagate-traces", True):
            headers = {
                "sentry-trace": sentry_sdk.get_traceparent() or "",
                "baggage": sentry_sdk.get_baggage() or "",
                **headers,
            }

        # Monitor config is patched in by the sentry_sdk
        # however, taskworkers do not support the nested object,
        # nor do they use it when creating checkins.
        if "sentry-monitor-config" in headers:
            del headers["sentry-monitor-config"]

        for key, value in headers.items():
            if value is None or isinstance(value, (str, bytes, int, bool, float)):
                headers[key] = str(value)
            else:
                raise ValueError(
                    "Only scalar header values are supported. "
                    f"The `{key}` header value is of type {type(value)}"
                )

        parameters_json = orjson.dumps({"args": args, "kwargs": kwargs})
        if (
            len(parameters_json) > MAX_PARAMETER_BYTES_BEFORE_COMPRESSION
            or self.compression_type == CompressionType.ZSTD
        ):
            # Worker uses this header to determine if the parameters are decompressed
            headers["compression-type"] = CompressionType.ZSTD.value
            start_time = time.perf_counter()
            parameters_str = base64.b64encode(zstd.compress(parameters_json)).decode("utf8")
            end_time = time.perf_counter()

            metrics.distribution(
                "taskworker.producer.compressed_parameters_size",
                len(parameters_str),
                tags={
                    "namespace": self._namespace.name,
                    "taskname": self.name,
                    "topic": self._namespace.topic.value,
                },
            )
            metrics.distribution(
                "taskworker.producer.compression_time",
                end_time - start_time,
                tags={
                    "namespace": self._namespace.name,
                    "taskname": self.name,
                    "topic": self._namespace.topic.value,
                },
            )
        else:
            parameters_str = parameters_json.decode("utf8")

        return TaskActivation(
            id=uuid4().hex,
            application=self._namespace.application,
            namespace=self._namespace.name,
            taskname=self.name,
            headers=headers,
            parameters=parameters_str,
            retry_state=self._create_retry_state(),
            received_at=received_at,
            processing_deadline_duration=processing_deadline,
            expires=expires,
            delay=countdown,
        )

    def _create_retry_state(self) -> RetryState:
        retry = self.retry or self._namespace.default_retry or None
        if not retry or self.at_most_once:
            # If the task and namespace have no retry policy,
            # or can only be attempted once make a single
            # attempt and then discard the task.
            return RetryState(
                attempts=0,
                max_attempts=1,
                on_attempts_exceeded=ON_ATTEMPTS_EXCEEDED_DISCARD,
                at_most_once=self.at_most_once,
            )
        return retry.initial_state()

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No retry policy means no retries.
        retry = self.retry
        if not retry:
            return False
        return retry.should_retry(state, exc)
