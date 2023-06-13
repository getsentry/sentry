from __future__ import annotations

import time
from typing import TypeVar

from arroyo.processing.strategies import MessageRejected, ProcessingStrategy, RunTask
from arroyo.types import FilteredPayload, Message

from sentry import options
from sentry.monitoring.queues import is_queue_healthy, monitor_queues

# As arroyo would otherwise busy-wait, we will sleep for a short time
# when a message is rejected.
SLEEP_MS = 10


class HealthChecker:
    def __init__(self):
        self.last_check: float = 0
        # Queue is healthy by default
        self.is_queue_healthy = True

        # TODO: this will eventually move to the monitor command
        monitor_queues()

    def is_healthy(self) -> bool:
        now = time.time()
        # Check queue health if it's been more than the interval
        if now - self.last_check >= options.get(
            "backpressure.monitor_queues.check_interval_in_seconds"
        ):
            # TODO: We would want to at first monitor everything all at once,
            # and make it more fine-grained later on.
            self.is_queue_healthy = is_queue_healthy("profiles.process")

            # We don't count the time it took to check as part of the interval
            self.last_check = now

        return self.is_queue_healthy


TPayload = TypeVar("TPayload")


def create_backpressure_step(
    health_checker: HealthChecker,
    next_step: ProcessingStrategy[FilteredPayload | TPayload],
) -> ProcessingStrategy[FilteredPayload | TPayload]:
    """
    This creates a new arroyo `ProcessingStrategy` that will check the `HealthChecker`
    and reject messages if the downstream step is not healthy.
    This strategy can be chained in front of the `next_step` that will do the actual
    processing.
    """

    def ensure_healthy_queue(message: Message[TPayload]) -> TPayload:
        if not health_checker.is_healthy():
            time.sleep(SLEEP_MS / 1000)
            raise MessageRejected()

        return message.payload

    return RunTask(function=ensure_healthy_queue, next_step=next_step)
