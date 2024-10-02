from abc import ABC, abstractmethod
from collections.abc import Mapping
from enum import Enum
from types import TracebackType
from typing import Any

from django.conf import settings

from sentry.utils import metrics


class EventLifecycleOutcome(Enum):
    STARTED = "STARTED"
    HALTED = "HALTED"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"

    def __str__(self) -> str:
        return self.value.lower()


class EventLifecycleMetric(ABC):
    @abstractmethod
    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        raise NotImplementedError

    def get_extras(self) -> Mapping[str, Any]:
        return {}

    def capture(self) -> "EventLifecycle":
        return EventLifecycle(self)


class EventLifecycleStateError(Exception):
    pass


class EventLifecycle:
    def __init__(self, payload: EventLifecycleMetric) -> None:
        self.payload = payload
        self._has_started = False
        self._has_halted = False

    def record_event(
        self,
        outcome: EventLifecycleOutcome,
        sample_rate: float = settings.SENTRY_METRICS_SAMPLE_RATE,
    ) -> None:
        key = self.payload.get_key(outcome)
        metrics.incr(key, sample_rate=sample_rate)

    def record_start(self) -> None:
        if self._has_started:
            raise EventLifecycleStateError("The lifecycle has already been entered")
        self._has_started = True

        self.record_event(EventLifecycleOutcome.STARTED)

    def record_success(self) -> None:
        if not self._has_started:
            raise EventLifecycleStateError("The lifecycle has not yet been entered")
        if self._has_halted:
            raise EventLifecycleStateError("The lifecycle has already been exited")
        self._has_halted = True

        self.record_event(EventLifecycleOutcome.SUCCESS)

    def record_failure(self, exc: BaseException | None = None) -> None:
        if not self._has_started:
            raise EventLifecycleStateError("The lifecycle has not yet been entered")
        if self._has_halted:
            raise EventLifecycleStateError("The lifecycle has already been exited")
        self._has_halted = True

        self.record_event(EventLifecycleOutcome.FAILURE, sample_rate=1.0)

    def __enter__(self) -> None:
        self.record_start()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType,
    ) -> None:
        if exc_value is not None:
            self.record_failure(exc_value)
        elif not self._has_halted:
            self.record_success()
