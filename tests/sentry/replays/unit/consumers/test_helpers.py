from collections.abc import Mapping
from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic


class MockCommit:
    def __init__(self):
        self.commit = {}

    def __call__(self, offsets: Mapping[Partition, int], force: bool = False) -> None:
        self.commit.update(offsets)


class MockSink:
    def __init__(self):
        self.accepted = []

    def accept(self, buffer):
        self.accepted.extend(buffer)


def make_kafka_message(message: bytes, topic: str = "a", index: int = 1, offset: int = 1):
    return Message(
        BrokerValue(
            KafkaPayload(b"k", message, []), Partition(Topic(topic), index), offset, datetime.now()
        )
    )
