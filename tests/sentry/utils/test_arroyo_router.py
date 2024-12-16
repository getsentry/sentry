import itertools
from datetime import datetime

from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.utils.arroyo_router import MessageBuffer


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
    assert len(buffer) == 4

    # The first message was completed, now it can be polled
    buffer.remove(Message(BrokerValue(None, partition, 0, None)), "route_a")
    msg = buffer.poll()
    assert msg is not None
    assert msg.value.offset == 0
    assert buffer.poll() is None
    assert len(buffer) == 3

    # Still waiting for route_b
    buffer.remove(Message(BrokerValue(None, partition, 2, None)), "route_a")
    assert buffer.poll() is None

    # All done, now we can poll the last 3 messages
    buffer.remove(Message(BrokerValue(None, partition, 3, None)), "route_b")
    assert buffer.poll() is not None
    assert buffer.poll() is not None
    assert buffer.poll() is not None
    assert buffer.poll() is None
    assert len(buffer) == 0
