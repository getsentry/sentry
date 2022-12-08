import logging
from typing import Any, Callable, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


def get_occurrences_ingest_consumer(
    consumer_type: str,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(consumer_type)


def create_ingest_occurences_consumer(
    topic_name: str, **options: Any
) -> StreamProcessor[KafkaPayload]:

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(settings.KAFKA_TOPICS[topic_name]["cluster"]),
            auto_offset_reset="latest",
            group_id="occurrence-consumer",
        )
    )

    strategy_factory = OccurrenceStrategyFactory()

    return StreamProcessor(
        consumer,
        Topic(topic_name),
        strategy_factory,
        ONCE_PER_SECOND,
    )


class OccurrenceStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        committer: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ):
        pass

    def poll(self) -> None:
        pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        logger.info(f"OCCURRENCE RECEIVED: {message.payload}")

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        pass


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return OccurrenceStrategy(commit, partitions)
