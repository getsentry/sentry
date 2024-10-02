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

    def capture(self, assume_success: bool = True) -> "EventLifecycle":
        return EventLifecycle(self, assume_success)


class EventLifecycleStateError(Exception):
    pass


class EventLifecycle:
    def __init__(self, payload: EventLifecycleMetric, assume_success: bool = True) -> None:
        self.payload = payload
        self.assume_success = assume_success
        self._state: EventLifecycleOutcome | None = None

    def record_event(self, outcome: EventLifecycleOutcome) -> None:
        key = self.payload.get_key(outcome)
        sample_rate = (
            1.0 if outcome == EventLifecycleOutcome.FAILURE else settings.SENTRY_METRICS_SAMPLE_RATE
        )
        metrics.incr(key, sample_rate=sample_rate)

    def record_start(self) -> None:
        if self._state is not None:
            raise EventLifecycleStateError("The lifecycle has already been entered")
        self._state = EventLifecycleOutcome.STARTED
        self.record_event(EventLifecycleOutcome.STARTED)

    def _terminate(self, new_state: EventLifecycleOutcome) -> None:
        if self._state is None:
            raise EventLifecycleStateError("The lifecycle has not yet been entered")
        if self._state != EventLifecycleOutcome.STARTED:
            raise EventLifecycleStateError("The lifecycle has already been exited")
        self._state = new_state
        self.record_event(new_state)

    def record_success(self) -> None:
        self._terminate(EventLifecycleOutcome.SUCCESS)

    def record_failure(self, exc: BaseException | None = None) -> None:
        self._terminate(EventLifecycleOutcome.FAILURE)

    def __enter__(self) -> None:
        self.record_start()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType,
    ) -> None:
        if exc_value is not None:
            # We were forced to exit the context by a raised exception.
            self.record_failure(exc_value)
        elif self._state == EventLifecycleOutcome.STARTED:
            # We exited the context without record_success or record_failure being
            # called. Assume success if we were told to do so. Else, log a halt
            # indicating that there is no clear success or failure signal.
            self._terminate(
                EventLifecycleOutcome.SUCCESS
                if self.assume_success
                else EventLifecycleOutcome.HALTED
            )
        else:
            # The context called record_success or record_failure being closing,
            # so we can just exit quietly.
            pass
