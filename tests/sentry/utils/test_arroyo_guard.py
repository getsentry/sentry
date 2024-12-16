from typing import Any

from arroyo.processing.strategies import MessageRejected, ProcessingStrategy
from arroyo.processing.strategies.noop import Noop
from arroyo.types import FilteredPayload, Message, TStrategyPayload, Value

from sentry.utils.arroyo_guard import NonFinalStrategy, guard


def test_guard() -> None:
    backpressure_on = False

    class NextStep(Noop):
        def __init__(self) -> None:
            self.messages_received = 0

        def submit(self, message: Message[FilteredPayload | TStrategyPayload]) -> None:
            if backpressure_on:
                raise MessageRejected
            self.messages_received += 1

    next_step = NextStep()

    @guard(3)
    class Strategy(NonFinalStrategy[int, int]):
        def __init__(self, next: ProcessingStrategy[Any]) -> None:
            self.next = next

        def submit(self, msg: Message[int]) -> None:
            # Sends 5 messages to the next strategy for each one received
            for _i in range(5):
                self.next.submit(msg)

        def poll(self) -> None:
            self.next.poll()

        def close(self) -> None:
            pass

        def terminate(self) -> None:
            pass

        def join(self, timeout: float | None = None) -> None:
            pass

    strategy = Strategy(next_step)

    # first one is accepted, strategy carries it over
    strategy.submit(Message(Value(1, {})))
    assert len(strategy._BackpressureGuard__messages_carried_over) == 0  # type:ignore[attr-defined]

    backpressure_on = True
    strategy.submit(Message(Value(2, {})))
    assert len(strategy._BackpressureGuard__messages_carried_over) == 5  # type:ignore[attr-defined]
    assert next_step.messages_received == 5

    # backpressure cleared
    backpressure_on = False

    # buffer cleared on poll
    strategy.poll()
    assert len(strategy._BackpressureGuard__messages_carried_over) == 0  # type:ignore[attr-defined]
    assert next_step.messages_received == 10

    # TODO: Test for invalid messages
