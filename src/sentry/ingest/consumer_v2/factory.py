from __future__ import annotations

from typing import Any, Mapping, MutableMapping

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.types import Commit, Partition
from django.conf import settings

from sentry.ingest.consumer_v2.ingest import process_ingest_message
from sentry.ingest.types import ConsumerType
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.utils import kafka_config
from sentry.utils.arroyo import RunTaskWithMultiprocessing


class IngestStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        consumer_type: str,
        num_processes: int,
        max_batch_size: int,
        max_batch_time: int,
        input_block_size: int,
        output_block_size: int,
    ):
        self.consumer_type = consumer_type
        self.num_processes = num_processes
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.health_checker = HealthChecker("ingest")

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:

        # The attachments consumer that is used for multiple message types needs
        # ordering guarantees: Attachments have to be written before the event using
        # them is being processed. We will use a simple serial `RunTask` for those
        # for now.
        if self.num_processes > 1 and self.consumer_type != ConsumerType.Attachments:
            next_step = RunTaskWithMultiprocessing(
                function=process_ingest_message,
                next_step=CommitOffsets(commit),
                num_processes=self.num_processes,
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            next_step = RunTask(
                function=process_ingest_message,
                next_step=CommitOffsets(commit),
            )

        return create_backpressure_step(health_checker=self.health_checker, next_step=next_step)


def get_ingest_consumer(
    consumer_type: str,
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    max_batch_size: int,
    max_batch_time: int,
    num_processes: int,
    input_block_size: int,
    output_block_size: int,
    force_topic: str | None,
    force_cluster: str | None,
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or ConsumerType.get_topic_name(consumer_type)
    consumer_config = get_config(
        topic,
        group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
        force_cluster=force_cluster,
    )
    consumer = KafkaConsumer(consumer_config)

    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=IngestStrategyFactory(
            consumer_type=consumer_type,
            num_processes=num_processes,
            max_batch_size=max_batch_size,
            max_batch_time=max_batch_time,
            input_block_size=input_block_size,
            output_block_size=output_block_size,
        ),
        commit_policy=ONCE_PER_SECOND,
    )


def get_config(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    force_cluster: str | None,
) -> MutableMapping[str, Any]:
    cluster_name: str = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]
    return build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster_name,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
    )
