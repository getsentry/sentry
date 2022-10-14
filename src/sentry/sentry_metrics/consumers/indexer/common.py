import logging
import time
from typing import Any, List, MutableMapping, Optional, Set

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies import ProcessingStrategy as ProcessingStep
from arroyo.types import Message
from django.conf import settings

from sentry.utils import kafka_config, metrics

MessageBatch = List[Message[KafkaPayload]]

logger = logging.getLogger(__name__)

DEFAULT_QUEUED_MAX_MESSAGE_KBYTES = 50000
DEFAULT_QUEUED_MIN_MESSAGES = 100000


def get_config(topic: str, group_id: str, auto_offset_reset: str) -> MutableMapping[Any, Any]:
    cluster_name: str = settings.KAFKA_TOPICS[topic]["cluster"]
    consumer_config: MutableMapping[str, Any] = build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster_name,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        queued_max_messages_kbytes=DEFAULT_QUEUED_MAX_MESSAGE_KBYTES,
        queued_min_messages=DEFAULT_QUEUED_MIN_MESSAGES,
    )
    return consumer_config


class DuplicateMessage(Exception):
    pass


class MetricsBatchBuilder:
    """
    Batches up individual messages - type: Message[KafkaPayload] - into a
    list, which will later be the payload for the big outer message
    that gets passed through to the ParallelTransformStep.

    See `__flush` method of BatchMessages for when that happens.
    """

    def __init__(self, max_batch_size: int, max_batch_time: float) -> None:
        self.__messages: MessageBatch = []
        self.__max_batch_size = max_batch_size
        self.__deadline = time.time() + max_batch_time / 1000.0
        self.__offsets: Set[int] = set()

    def __len__(self) -> int:
        return len(self.__messages)

    @property
    def messages(self) -> MessageBatch:
        return self.__messages

    def append(self, message: Message[KafkaPayload]) -> None:
        if message.offset in self.__offsets:
            raise DuplicateMessage
        self.__messages.append(message)
        self.__offsets.add(message.offset)

    def ready(self) -> bool:
        if len(self.messages) >= self.__max_batch_size:
            return True
        elif time.time() >= self.__deadline:
            return True
        else:
            return False


class BatchMessages(ProcessingStep[KafkaPayload]):
    """
    First processing step in the MetricsConsumerStrategyFactory.
    Keeps track of a batch of messages (using the MetricsBatchBuilder)
    and then when at capacity, either max_batch_time or max_batch_size,
    flushes the batch.

    Flushing the batch here means wrapping the batch in a Message, the batch
    itself being the payload. This is what the ParallelTransformStep will
    process in the process_message function.
    """

    def __init__(
        self,
        next_step: ProcessingStrategy[MessageBatch],
        max_batch_time: float,
        max_batch_size: int,
    ):
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time

        self.__next_step = next_step
        self.__batch: Optional[MetricsBatchBuilder] = None
        self.__closed = False
        self.__batch_start: Optional[float] = None

    def poll(self) -> None:
        assert not self.__closed

        self.__next_step.poll()

        if self.__batch and self.__batch.ready():
            try:
                self.__flush()
            except MessageRejected:
                # Probably means that we have received back pressure due to the
                # ParallelTransformStep.
                logger.debug("Attempt to flush batch failed...Re-trying in next poll")
                pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        if self.__batch is None:
            self.__batch_start = time.time()
            self.__batch = MetricsBatchBuilder(self.__max_batch_size, self.__max_batch_time)

        try:
            self.__batch.append(message)
        except DuplicateMessage:
            # If we are getting back pressure from the next_step (ParallelTransformStep),
            # the consumer will keep trying to submit the same carried over message
            # until it succeeds and stops throwing the MessageRejected error. In this
            # case we don't want to keep adding the same message to the batch over and
            # over again
            logger.debug(f"Message already added to batch with offset: {message.offset}")
            pass

        if self.__batch and self.__batch.ready():
            self.__flush()

    def __flush(self) -> None:
        if not self.__batch:
            return
        last = self.__batch.messages[-1]

        new_message = Message(last.partition, last.offset, self.__batch.messages, last.timestamp)
        if self.__batch_start is not None:
            elapsed_time = time.time() - self.__batch_start
            metrics.timing("batch_messages.build_time", elapsed_time)
            self.__batch_start = None

        self.__next_step.submit(new_message)
        self.__batch = None

    def terminate(self) -> None:
        self.__closed = True
        self.__next_step.terminate()

    def close(self) -> None:
        self.__closed = True

    def join(self, timeout: Optional[float] = None) -> None:
        if self.__batch:
            last = self.__batch.messages[-1]
            logger.debug(
                f"Abandoning batch of {len(self.__batch)} messages...latest offset: {last.offset}"
            )

        self.__next_step.close()
        self.__next_step.join(timeout)
