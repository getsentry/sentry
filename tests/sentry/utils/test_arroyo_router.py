from collections.abc import Callable, Mapping
from datetime import datetime

from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.processing.strategies.noop import Noop
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.utils.arroyo_router import MessageBuffer, Router


def test_message_buffer() -> None:
    partition = Partition(Topic("test"), 0)

    messages = [Message(BrokerValue(i, partition, i, datetime.now())) for i in range(4)]
    buffer: MessageBuffer[int] = MessageBuffer(["route_a", "route_b"])

    # Add two messages to each route
    buffer.start(messages[0], "route_a")
    buffer.start(messages[1], "route_b")
    buffer.start(messages[2], "route_a")
    buffer.start(messages[3], "route_b")

    # All messages are in-flight, poll returns nothing
    assert buffer.poll() is None
    assert len(buffer) == 0

    # The first message was completed, now it can be polled
    buffer.submit(messages[0], "route_a")
    assert len(buffer) == 1
    msg = buffer.poll()
    assert msg is not None
    assert len(buffer) == 0
    assert msg.value.offset == 0
    assert buffer.poll() is None

    # Second message is done
    buffer.submit(messages[2], "route_a")
    assert buffer.poll() is not None

    # Third message was filtered, but the last message is done
    buffer.submit(messages[3], "route_b")
    assert buffer.poll() is not None
    assert buffer.poll() is None


def test_router() -> None:
    def routing_func(msg: Message[int]) -> str:
        return "add_one"

    def get_adder(value: int) -> Callable[[Message[int]], int]:
        def adder(msg: Message[int]) -> int:
            return value + msg.value

        return adder

    route_builders: Mapping[str, Callable[[ProcessingStrategy[int]], ProcessingStrategy[int]]] = {
        "add_one": lambda next: RunTask(get_adder(1), next),
        "add_two": lambda next: RunTask(get_adder(2), next),
    }

    router = Router(Noop(), route_builders, routing_func)

    # TODO: Write test
