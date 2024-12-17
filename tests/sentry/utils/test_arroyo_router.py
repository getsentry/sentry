import itertools
from datetime import datetime

from arroyo.processing.strategies.noop import Noop
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.utils.arroyo_router import MessageBuffer, Router


def test_message_buffer() -> None:
    partition = Partition(Topic("test"), 0)

    count = itertools.count()
    msg_seq = (Message(BrokerValue(None, partition, i, datetime.now())) for i in count)
    buffer = MessageBuffer(["route_a", "route_b"])

    # Add two messages to each route
    buffer.add(next(msg_seq), "route_a")
    buffer.add(next(msg_seq), "route_b")
    buffer.add(next(msg_seq), "route_a")
    buffer.add(next(msg_seq), "route_b")

    # All messages are in-flight, poll returns nothing
    assert buffer.poll() is None
    assert len(buffer.messages) == 4

    # The first message was completed, now it can be polled
    buffer.remove(Message(BrokerValue(None, partition, 0, None)), "route_a")
    msg = buffer.poll()
    assert msg is not None
    assert msg.value.offset == 0
    assert buffer.poll() is None
    assert len(buffer.messages) == 3

    # Still waiting for route_b
    buffer.remove(Message(BrokerValue(None, partition, 2, None)), "route_a")
    assert buffer.poll() is None

    # All done, now we can poll the last 3 messages
    buffer.remove(Message(BrokerValue(None, partition, 3, None)), "route_b")
    assert buffer.poll() is not None
    assert buffer.poll() is not None
    assert buffer.poll() is not None
    assert buffer.poll() is None
    assert len(buffer.messages) == 0


def test_router() -> None:
    def routing_func(msg) -> str:
        return "add_one"

    route_builders = {
        "add_one": lambda next: RunTask(next, lambda msg: msg.value + 1),
        "add_two": lambda next: RunTask(next, lambda msg: msg.value + 2),
    }

    router = Router(Noop(), route_builders, routing_func)

    # TODO: Write test
