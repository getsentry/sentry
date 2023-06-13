from __future__ import annotations

import time
from typing import TypeVar

from arroyo.processing.strategies import MessageRejected, ProcessingStrategy, RunTask
from arroyo.types import FilteredPayload, Message

# As arroyo would otherwise busy-wait, we will sleep for a short time
# when a message is rejected.
SLEEP_MS = 10


class HealthChecker:
    def __init__(self):
        # TODO: we should define in the constructor which queues we want to check, etc
        pass

    def is_healthy(self) -> bool:
        # TODO: actually check things :-)
        return True


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
