import time
from collections.abc import Callable, Mapping, MutableMapping
from concurrent.futures import Future
from datetime import datetime, timedelta, timezone
from enum import Enum

from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.dlq import InvalidMessage, KafkaDlqProducer
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import FILTERED_PAYLOAD, BrokerValue, Message, Partition
from arroyo.types import Topic as ArroyoTopic
from arroyo.types import Value

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition


class RejectReason(Enum):
    STALE = "stale"
    INVALID = "invalid"


class MultipleDestinationDlqProducer(KafkaDlqProducer):
    """
    Produces to either the DLQ or stale message topic depending on the reason.
    """

    def __init__(
        self,
        producers: Mapping[RejectReason, KafkaDlqProducer],
        topic_selector: Callable[[BrokerValue[KafkaPayload], str], RejectReason],
    ) -> None:
        self.producers = producers
        self.topic_selector = topic_selector

    def produce(
        self, value: BrokerValue[KafkaPayload], reason: str
    ) -> Future[BrokerValue[KafkaPayload]]:
        return self.producers[self.topic_selector(value, reason)].produce(value)


def _get_dlq_producer(topic: Topic | None) -> KafkaDlqProducer | None:
    if topic is None:
        return None

    topic_defn = get_topic_definition(topic)
    config = get_kafka_producer_cluster_options(topic_defn["cluster"])
    real_topic = topic_defn["real_topic_name"]
    return KafkaDlqProducer(KafkaProducer(config), ArroyoTopic(real_topic))


def build_dlq_producer(
    dlq_topic: Topic | None, stale_topic: Topic | None
) -> MultipleDestinationDlqProducer | None:
    if dlq_topic is None and stale_topic is None:
        return None

    producers = {
        RejectReason.INVALID: _get_dlq_producer(dlq_topic),
        RejectReason.STALE: _get_dlq_producer(stale_topic),
    }

    return MultipleDestinationDlqProducer(producers)


class DlqStaleMessages(ProcessingStrategy):
    def __init__(
        self, stale_threshold_sec: int, next_step: ProcessingStrategy[KafkaPayload]
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
            message_timestamp = message.timestamp.astimezone(timezone.utc)
            if message_timestamp < min_accepted_timestamp:
                self.offsets_to_forward[message.value.partition, message.value.next_offset]
                raise InvalidMessage(
                    message.value.partition, message.value.offset, RejectReason.STALE.value
                )

        if self.offsets_to_forward and time.time() > self.last_forwarded_offsets + 1:
            message = Message(Value(FILTERED_PAYLOAD), self.offsets_to_forward)
            self.offsets_to_forward = {}
            self.next_step.submit(message)

    def poll(self) -> None:
        self.next_step.poll()

    def join(self, timeout: float | None = None) -> None:
        self.next_step.join(timeout)

    def close(self) -> None:
        self.next_step.close()

    def terminate(self) -> None:
        self.next_step.terminate()


class DlqStaleMessagesStrategyFactoryWrapper(ProcessingStrategyFactory):
    """
    Wrapper used to dlq a message with a stale timestamp before it is passed to
    the rest of the pipeline. The InvalidMessage is raised with a
    "stale" reason so it can be routed to a separate stale topic.
    """

    def __init__(self, stale_threshold_sec: int, inner: ProcessingStrategyFactory) -> None:
        self.stale_threshold_sec = stale_threshold_sec
        self.inner = inner

    def create_with_partitions(self, commit, partitions) -> ProcessingStrategy:
        rv = self.inner.create_with_partitions(commit, partitions)
        return DlqStaleMessages(self.stale_threshold_sec, rv)
