from collections.abc import Mapping, MutableMapping
from datetime import datetime
from typing import cast

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.replays.consumers.buffered.platform import Flags, Model, Msg, RunTime


class MockCommit:
    def __init__(self):
        self.commit = {}

    def __call__(self, offsets: Mapping[Partition, int], force: bool = False) -> None:
        self.commit.update(offsets)


class MockRunTime(RunTime[Model, Msg, Flags]):
    def _handle_msg(self, msg):
        while True:
            model, cmd = self.update(self.model, msg)
            self._model = model
            msg = yield cmd

    def submit(self, message):
        yield from self._handle_msg(
            self.process(
                self.model,
                message.payload.value,
                cast(MutableMapping[Partition, int], message.committable),
            )
        )


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
