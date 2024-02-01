import logging
import time
from typing import Any, Optional

import sentry_kafka_schemas
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message

logger = logging.getLogger(__name__)


class ValidateSchema(ProcessingStrategy[KafkaPayload]):
    """
    Since ValidateSchema is currently a separate step to the main message
    processing function, messages that are validated will be decoded twice. As a result,
    we don't validate a large number of messages outside of dev and test environments.

    If enforce_schema=True is passed, every message that fails validation will
    raise an error and crash the consumer. This is designed for use in dev and test
    environments. Otherwise, we rate limit message validation to once per second and log
    warnings.
    """

    def __init__(
        self, topic: str, enforce_schema: bool, next_step: ProcessingStrategy[KafkaPayload]
    ) -> None:
        self.__topic = topic
        self.__enforce_schema = enforce_schema
        self.__next_step = next_step
        self.__last_record_time: Optional[float] = None

        self.__codec: Optional[sentry_kafka_schemas.codecs.Codec[Any]]
        try:
            self.__codec = sentry_kafka_schemas.get_codec(topic)
        except sentry_kafka_schemas.SchemaNotFound:
            self.__codec = None

    def submit(self, message: Message[KafkaPayload]) -> None:
        if self.__enforce_schema:
            if self.__codec is not None:
                # This will raise an exception if the message is invalid
                self.__codec.decode(message.payload.value, validate=True)
        else:
            now = time.time()
            if self.__last_record_time is None or self.__last_record_time + 1.0 < now:
                with sentry_sdk.push_scope() as scope:
                    scope.add_attachment(bytes=message.payload.value, filename="message.txt")
                    scope.set_tag("topic", self.__topic)

                if self.__codec is None:
                    logger.warning("No validator configured for topic")
                else:
                    try:
                        self.__codec.decode(message.payload.value)
                    except sentry_kafka_schemas.codecs.ValidationError:
                        logger.warning("Invalid message received")
                    self.__last_record_time = now

        self.__next_step.submit(message)

    def poll(self) -> None:
        self.__next_step.poll()

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.join(timeout)

    def close(self) -> None:
        self.__next_step.close()

    def terminate(self) -> None:
        self.__next_step.terminate()
