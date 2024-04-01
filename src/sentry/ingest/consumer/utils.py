import functools

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message

from sentry.ingest.consumer.processors import Retriable


def dlq_invalid_messages(f):
    @functools.wraps(f)
    def inner(raw_message, *args, **kwargs):
        if not isinstance(raw_message, Message) or not isinstance(
            raw_message.value.payload, KafkaPayload
        ):
            raise TypeError("Expected raw_message to be type arroyo.types.Message[KafkaPayload]")
        try:
            f(raw_message, *args, **kwargs)
        except Exception as exc:
            # If the retriable exception was raised, we should not DLQ
            if isinstance(exc, Retriable):
                raise

            raw_value = raw_message.value
            assert isinstance(raw_value, BrokerValue)
            raise InvalidMessage(raw_value.partition, raw_value.offset) from exc

    return inner
