import logging
import signal
from typing import Callable, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.utils import metrics
from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


def create_batching_kafka_consumer(topic_names, worker, **options):
    # In some cases we want to override the configuration stored in settings from the command line
    force_topic = options.pop("force_topic", None)
    force_cluster = options.pop("force_cluster", None)

    if force_topic and force_cluster:
        topic_names = {force_topic}
        cluster_names = {force_cluster}
    elif force_topic or force_cluster:
        raise ValueError(
            "Both 'force_topic' and 'force_cluster' have to be provided to override the configuration"
        )
    else:
        cluster_names = {settings.KAFKA_TOPICS[topic_name]["cluster"] for topic_name in topic_names}

    if len(cluster_names) > 1:
        raise ValueError(
            f"Cannot launch Kafka consumer listening to multiple topics ({topic_names}) on different clusters ({cluster_names})"
        )

    (cluster_name,) = cluster_names

    consumer = BatchingKafkaConsumer(
        topics=topic_names,
        cluster_name=cluster_name,
        worker=worker,
        metrics=metrics,
        metrics_default_tags={
            "topics": ",".join(sorted(topic_names)),
            "group_id": options.get("group_id"),
        },
        **options,
    )

    def handler(signum, frame):
        consumer.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    return consumer


def create_ingest_occurences_consumer(topic_name, **options):

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(settings.KAFKA_TOPICS[topic_name]["cluster"]),
            auto_offset_reset="latest",
            group_id="test-group",
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
    def __init__(self):
        pass

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return OccurrenceStrategy(commit, partitions)
