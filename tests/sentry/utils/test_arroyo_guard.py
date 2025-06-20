from datetime import datetime
from typing import Any

import pytest
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies import MessageRejected, ProcessingStrategy
from arroyo.processing.strategies.noop import Noop
from arroyo.types import (
    BrokerValue,
    FilteredPayload,
    Message,
    Partition,
    Topic,
    TStrategyPayload,
    Value,
)

from sentry.utils.arroyo_guard import NonFinalStrategy, guard


def test_guard() -> None:
    backpressure_on = False
    raise_invalid: tuple[Partition, int] | None = None

    class NextStep(Noop):
        def __init__(self) -> None:
            self.messages_received = 0
            self.invalid_offsets = []

        def submit(self, message: Message[FilteredPayload | TStrategyPayload]) -> None:
            if backpressure_on:
                raise MessageRejected
            if raise_invalid and not isinstance(message.payload, FilteredPayload):
                assert isinstance(message.value, BrokerValue)
                self.invalid_offsets.append(raise_invalid[1])
                raise InvalidMessage(raise_invalid[0], raise_invalid[1])
            self.messages_received += 1

    next_step = NextStep()

    @guard
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

    # first one is accepted, strategy c arries it over
    strategy.submit(Message(Value(1, {})))
    assert len(strategy._Guard__messages_carried_over) == 0  # type:ignore[attr-defined]

    backpressure_on = True
    strategy.submit(Message(Value(2, {})))
    assert len(strategy._Guard__messages_carried_over) == 5  # type:ignore[attr-defined]
    assert next_step.messages_received == 5

    # backpressure cleared
    backpressure_on = False

    # buffer cleared on poll
    strategy.poll()
    assert len(strategy._Guard__messages_carried_over) == 0  # type:ignore[attr-defined]
    assert next_step.messages_received == 10

    # Invalid message
    partition = Partition(Topic("test"), 0)
    raise_invalid = (partition, 3)

    with pytest.raises(InvalidMessage):
        strategy.submit(Message(BrokerValue(3, partition, 3, datetime.now())))
    assert next_step.invalid_offsets == [3]

    # clear invalid messae
    raise_invalid = None

    # pending messages should get processed now
    strategy.poll()

    # 4 is initially accepted but it will be raised as invalid later
    strategy.submit(Message(BrokerValue(4, partition, 4, datetime.now())))

    # 4 is invalid, 5 is later accepted
    raise_invalid = (partition, 4)
    with pytest.raises(InvalidMessage):
        strategy.submit(Message(BrokerValue(5, partition, 5, datetime.now())))
    raise_invalid = None
    strategy.poll()
    assert next_step.invalid_offsets == [3, 4]
