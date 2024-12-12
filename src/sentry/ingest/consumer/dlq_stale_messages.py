from datetime import datetime

from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies import ProcessingStrategy, RunTask
from arroyo.types import BrokerValue, Message, TypeVar

TPayload = TypeVar("TPayload")


def create_dlq_stale_messages_step(next_step: ProcessingStrategy[TPayload], threshold_sec: int):
    def dlq_delayed_messages(message: Message[TPayload]) -> TPayload:
        min_accepted_timestamp = datetime.utcnow() - threshold_sec

        if isinstance(message.value, BrokerValue):
            if message.timestamp and message.timestamp < min_accepted_timestamp:
                raise InvalidMessage(message.value.partition, message.value.offset)

        return message.payload

    return RunTask(function=dlq_delayed_messages, next_step=next_step)
