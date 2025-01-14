import logging
import time
from collections.abc import Mapping, MutableMapping
from concurrent.futures import Future
from datetime import datetime, timedelta, timezone
from enum import Enum

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.dlq import InvalidMessage, KafkaDlqProducer
from arroyo.processing.strategies.abstract import (
    MessageRejected,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.types import FILTERED_PAYLOAD, BrokerValue, Commit, FilteredPayload, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from arroyo.types import Value

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class RejectReason(Enum):
    STALE = "stale"
    INVALID = "invalid"


class MultipleDestinationDlqProducer(KafkaDlqProducer):
    """
    Produces to either the DLQ or stale message topic depending on the reason.
    """

    def __init__(
        self,
        producers: Mapping[RejectReason, KafkaDlqProducer | None],
    ) -> None:
        self.producers = producers

    def produce(
        self,
        value: BrokerValue[KafkaPayload],
        reason: str | None = None,
    ) -> Future[BrokerValue[KafkaPayload]]:

        reject_reason = RejectReason(reason) if reason else RejectReason.INVALID
        producer = self.producers.get(reject_reason)

        if producer:
            return producer.produce(value)
        else:
            # No DLQ producer configured for the reason.
            logger.error("No DLQ producer configured for reason %s", reason)
            future: Future[BrokerValue[KafkaPayload]] = Future()
            future.set_running_or_notify_cancel()
            future.set_result(value)
            return future


def _get_dlq_producer(topic: Topic | None) -> KafkaDlqProducer | None:
    if topic is None:
        return None

    topic_defn = get_topic_definition(topic)
    config = get_kafka_producer_cluster_options(topic_defn["cluster"])
    real_topic = topic_defn["real_topic_name"]
    return KafkaDlqProducer(KafkaProducer(config), ArroyoTopic(real_topic))


def maybe_build_dlq_producer(
    dlq_topic: Topic | None,
    stale_topic: Topic | None,
) -> MultipleDestinationDlqProducer | None:
    if dlq_topic is None and stale_topic is None:
        return None

    producers = {
        RejectReason.INVALID: _get_dlq_producer(dlq_topic),
        RejectReason.STALE: _get_dlq_producer(stale_topic),
    }

    return MultipleDestinationDlqProducer(producers)


class DlqStaleMessages(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        stale_threshold_sec: int,
        next_step: ProcessingStrategy[KafkaPayload | FilteredPayload],
    ) -> None:
        self.stale_threshold_sec = stale_threshold_sec
        self.next_step = next_step

        # A filtered message is created so we commit periodically if all are stale.
        self.last_forwarded_offsets = time.time()
        self.offsets_to_forward: MutableMapping[Partition, int] = {}

    def submit(self, message: Message[KafkaPayload]) -> None:
        min_accepted_timestamp = datetime.now(timezone.utc) - timedelta(
            seconds=self.stale_threshold_sec
        )

        if isinstance(message.value, BrokerValue):
            # Normalize the message timezone to be UTC
            if message.value.timestamp.tzinfo is None:
                message_timestamp = message.value.timestamp.replace(tzinfo=timezone.utc)
            else:
                message_timestamp = message.value.timestamp

            if message_timestamp < min_accepted_timestamp:
                self.offsets_to_forward[message.value.partition] = message.value.next_offset
                raise InvalidMessage(
                    message.value.partition,
                    message.value.offset,
                    reason=RejectReason.STALE.value,
                    log_exception=False,
                )

        # If we get a valid message for a partition later, don't emit a filtered message for it
        if self.offsets_to_forward:
            for partition in message.committable:
                self.offsets_to_forward.pop(partition, None)

        self.next_step.submit(message)

    def poll(self) -> None:
        self.next_step.poll()

        # Ensure we commit frequently even if all messages are invalid
        if self.offsets_to_forward:
            if time.time() > self.last_forwarded_offsets + 1:
                filtered_message = Message(Value(FILTERED_PAYLOAD, self.offsets_to_forward))
                try:
                    self.next_step.submit(filtered_message)
                    self.offsets_to_forward = {}
                    self.last_forwarded_offsets = time.time()
                except MessageRejected:
                    pass

    def join(self, timeout: float | None = None) -> None:
        self.next_step.join(timeout)

    def close(self) -> None:
        self.next_step.close()

    def terminate(self) -> None:
        self.next_step.terminate()


class DlqStaleMessagesStrategyFactoryWrapper(ProcessingStrategyFactory[KafkaPayload]):
    """
    Wrapper used to dlq a message with a stale timestamp before it is passed to
    the rest of the pipeline. The InvalidMessage is raised with a
    "stale" reason so it can be routed to a separate stale topic.
    """

    def __init__(
        self,
        stale_threshold_sec: int,
        inner: ProcessingStrategyFactory[KafkaPayload | FilteredPayload],
    ) -> None:
        self.stale_threshold_sec = stale_threshold_sec
        self.inner = inner

    def create_with_partitions(
        self, commit: Commit, partitions: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        rv = self.inner.create_with_partitions(commit, partitions)
        return DlqStaleMessages(self.stale_threshold_sec, rv)
