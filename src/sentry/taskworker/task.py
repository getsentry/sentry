from __future__ import annotations

import datetime
from collections.abc import Callable
from functools import update_wrapper
from typing import TYPE_CHECKING, Generic, ParamSpec, TypeVar
from uuid import uuid4

import orjson
import sentry_sdk
from django.conf import settings
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    ON_ATTEMPTS_EXCEEDED_DISCARD,
    RetryState,
    TaskActivation,
)

from sentry.taskworker.constants import DEFAULT_PROCESSING_DEADLINE
from sentry.taskworker.retry import Retry

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
        update_wrapper(self, func)

    @property
    def fullname(self) -> str:
        return f"{self._namespace.name}:{self.name}"

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
        self.apply_async(*args, **kwargs)

    def apply_async(self, *args: P.args, **kwargs: P.kwargs) -> None:
        """
        Schedule a task to run later with a set of arguments.

        The provided parameters will be JSON encoded and stored within
        a `TaskActivation` protobuf that is appended to kafka
        """
        if settings.TASK_WORKER_ALWAYS_EAGER:
            self._func(*args, **kwargs)
        else:
            # TODO(taskworker) promote parameters to headers
            self._namespace.send_task(
                self.create_activation(*args, **kwargs), wait_for_delivery=self.wait_for_delivery
            )

    def create_activation(self, *args: P.args, **kwargs: P.kwargs) -> TaskActivation:
        received_at = Timestamp()
        received_at.FromDatetime(timezone.now())

        processing_deadline = self._processing_deadline_duration
        if isinstance(processing_deadline, datetime.timedelta):
            processing_deadline = int(processing_deadline.total_seconds())

        expires = self._expires
        if isinstance(expires, datetime.timedelta):
            expires = int(expires.total_seconds())

        headers = {
            "sentry-trace": sentry_sdk.get_traceparent() or "",
            "baggage": sentry_sdk.get_baggage() or "",
        }

        return TaskActivation(
            id=uuid4().hex,
            namespace=self._namespace.name,
            taskname=self.name,
            headers=headers,
            parameters=orjson.dumps({"args": args, "kwargs": kwargs}).decode("utf8"),
            retry_state=self._create_retry_state(),
            received_at=received_at,
            processing_deadline_duration=processing_deadline,
            expires=expires,
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
