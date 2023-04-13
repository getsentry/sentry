import logging
from functools import partial
from typing import Mapping

import rapidjson
from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload, build_kafka_consumer_configuration
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTaskWithMultiprocessing,
)
from arroyo.types import Commit, Message, Partition

from sentry.snuba.utils import initialize_consumer_state

logger = logging.getLogger(__name__)


def get_occurrences_ingest_consumer(
    consumer_type: str,
    auto_offset_reset: str,
    group_id: str,
    strict_offset_reset: bool,
    max_batch_size: int,
    max_batch_time: int,
    processes: int,
    input_block_size: int,
    output_block_size: int,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(
        consumer_type,
        auto_offset_reset,
        group_id,
        strict_offset_reset,
        max_batch_size,
        max_batch_time,
        processes,
        input_block_size,
        output_block_size,
    )


def create_ingest_occurences_consumer(
    topic_name: str,
    auto_offset_reset: str,
    group_id: str,
    strict_offset_reset: bool,
    max_batch_size: int,
    max_batch_time: int,
    processes: int,
    input_block_size: int,
    output_block_size: int,
) -> StreamProcessor[KafkaPayload]:
    from django.conf import settings

    from sentry.utils.batching_kafka_consumer import create_topics
    from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

    kafka_cluster = settings.KAFKA_TOPICS[topic_name]["cluster"]
    create_topics(kafka_cluster, [topic_name])

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(kafka_cluster),
            auto_offset_reset=auto_offset_reset,
            group_id=group_id,
            strict_offset_reset=strict_offset_reset,
        )
    )

    strategy_factory = OccurrenceStrategyFactory(
        max_batch_size,
        max_batch_time,
        processes,
        input_block_size,
        output_block_size,
    )

    return StreamProcessor(
        consumer,
        Topic(topic_name),
        strategy_factory,
        ONCE_PER_SECOND,
    )


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        processes: int,
        input_block_size: int,
        output_block_size: int,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = processes
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskWithMultiprocessing(
            process_message,
            CommitOffsets(commit),
            self.num_processes,
            self.max_batch_size,
            self.max_batch_time,
            self.input_block_size,
            self.output_block_size,
            initializer=partial(initialize_consumer_state),
        )


def process_message(message: Message[KafkaPayload]) -> None:
    from sentry.issues.occurrence_consumer import (
        EventLookupError,
        InvalidEventPayloadError,
        _process_message,
    )
    from sentry.utils import json, metrics

    try:
        with metrics.timer("occurrence_consumer.process_message"):
            payload = json.loads(message.payload.value, use_rapid_json=True)
            _process_message(payload)
    except (
        rapidjson.JSONDecodeError,
        InvalidEventPayloadError,
        EventLookupError,
        Exception,
    ):
        logger.exception("failed to process message payload")
